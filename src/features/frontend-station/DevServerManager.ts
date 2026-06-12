/**
 * DevServerManager — dev server lifecycle management.
 *
 * Manages create / start / stop / restart for frontend dev servers
 * backed by child processes. Emits lifecycle events so the UI layer
 * can react to state changes and HMR updates.
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import type { DevProject, ProjectTemplate } from './types';

// ── Events ─────────────────────────────────────────────────────────────────

export interface DevServerEvents {
  'server-ready': (projectId: string, url: string) => void;
  'server-error': (projectId: string, error: Error) => void;
  'server-stopped': (projectId: string) => void;
  'hmr-update': (projectId: string) => void;
}

export interface DevServerManagerOptions {
  defaultHost?: string;
  portRange?: [number, number];
  spawnProcess?: (
    command: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ) => ManagedDevProcess;
}

const DEFAULT_OPTIONS: Required<DevServerManagerOptions> = {
  defaultHost: '127.0.0.1',
  portRange: [5173, 5199],
  spawnProcess: defaultSpawnProcess,
};

// ── Manager ─────────────────────────────────────────────────────────────────

export class DevServerManager extends EventEmitter {
  private projects: Map<string, DevProject> = new Map();
  private processes: Map<string, ManagedDevProcess> = new Map();
  private options: Required<DevServerManagerOptions>;

  constructor(options?: DevServerManagerOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Create a new dev project entry without starting the server.
   */
  async createProject(opts: {
    name: string;
    template: ProjectTemplate;
    path: string;
  }): Promise<DevProject> {
    const project: DevProject = {
      id: randomUUID(),
      name: opts.name,
      template: opts.template,
      path: opts.path,
      port: this.allocatePort(),
      status: 'stopped',
      createdAt: new Date().toISOString(),
    };

    this.projects.set(project.id, project);
    return project;
  }

  /**
   * Start the dev server for a project.
   * Skeleton: spawn logic omitted — replace with actual child_process.spawn.
   */
  async startServer(projectId: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    if (project.status === 'running' || project.status === 'starting') {
      return;
    }

    project.status = 'starting';

    try {
      const { command, args } = this.buildStartCommand(project);
      const child = this.options.spawnProcess(command, args, {
        cwd: project.path,
        env: process.env,
      });

      this.processes.set(projectId, child);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let ready = false;

        const markReady = (line: string) => {
          if (ready) {
            return;
          }

          const readyUrl =
            extractReadyUrl(line)
            ?? (isReadyOutput(line, project.port) ? this.getPreviewUrl(projectId) : null);

          if (!readyUrl) {
            return;
          }

          ready = true;
          project.status = 'running';
          this.emit('server-ready', projectId, readyUrl);
          settled = true;
          resolve();
        };

        const onOutput = (chunk: string | Buffer) => {
          markReady(chunk.toString());
        };

        child.stdout?.on('data', onOutput);
        child.stderr?.on('data', onOutput);

        child.once('error', (error) => {
          project.status = 'error';
          this.processes.delete(projectId);
          this.emit('server-error', projectId, error);
          if (!settled) {
            settled = true;
            reject(error);
          }
        });

        child.once('exit', (code) => {
          const wasManaged = this.processes.get(projectId) === child;
          if (!wasManaged) {
            return;
          }

          this.processes.delete(projectId);
          if (ready) {
            project.status = 'stopped';
            this.emit('server-stopped', projectId);
            return;
          }

          const error = new Error(
            `Dev server exited before becoming ready (exit ${code ?? 'unknown'})`,
          );
          project.status = 'error';
          this.emit('server-error', projectId, error);
          if (!settled) {
            settled = true;
            reject(error);
          }
        });
      });
    } catch (err) {
      project.status = 'error';
      this.emit('server-error', projectId, err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Stop the dev server for a project.
   */
  async stopServer(projectId: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    if (project.status === 'stopped') {
      return;
    }

    const proc = this.processes.get(projectId);
    if (proc) {
      proc.kill();
      this.processes.delete(projectId);
    }

    project.status = 'stopped';
    this.emit('server-stopped', projectId);
  }

  /**
   * Restart the dev server for a project.
   */
  async restartServer(projectId: string): Promise<void> {
    await this.stopServer(projectId);
    await this.startServer(projectId);
  }

  /**
   * Get the preview URL for a running project.
   */
  getPreviewUrl(projectId: string): string {
    const project = this.getProject(projectId);
    if (!project) {
      return '';
    }
    return `http://${this.options.defaultHost}:${project.port}`;
  }

  /**
   * Return all managed projects.
   */
  getProjects(): DevProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * Get a single project by ID.
   */
  getProject(id: string): DevProject | undefined {
    return this.projects.get(id);
  }

  // ── Internal helpers ───────────────────────────────────────────

  private nextPortIndex = 0;

  private allocatePort(): number {
    const [min, max] = this.options.portRange;
    const port = min + this.nextPortIndex;
    this.nextPortIndex = (this.nextPortIndex + 1) % (max - min + 1);
    return port;
  }

  private buildStartCommand(
    project: DevProject,
  ): { command: string; args: string[] } {
    switch (project.template) {
      case 'nextjs':
        return {
          command: 'npm',
          args: [
            'run',
            'dev',
            '--',
            '--hostname',
            this.options.defaultHost,
            '--port',
            String(project.port),
          ],
        };
      case 'vite-react':
      case 'vite-vue':
        return {
          command: 'npm',
          args: [
            'run',
            'dev',
            '--',
            '--host',
            this.options.defaultHost,
            '--port',
            String(project.port),
          ],
        };
      case 'blank':
        return {
          command: 'node',
          args: [
            'server.js',
            '--host',
            this.options.defaultHost,
            '--port',
            String(project.port),
          ],
        };
      default:
        throw new Error(`Unsupported project template: ${project.template}`);
    }
  }
}

export interface ManagedDevProcess extends EventEmitter {
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
  kill(signal?: NodeJS.Signals | number): boolean;
}

function defaultSpawnProcess(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): ManagedDevProcess {
  return spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as unknown as ManagedDevProcess;
}

function isReadyOutput(line: string, port: number): boolean {
  const normalized = line.toLowerCase();
  return (
    normalized.includes(String(port))
    && (
      normalized.includes('ready')
      || normalized.includes('local:')
      || normalized.includes('listening')
      || normalized.includes('started')
    )
  );
}

function extractReadyUrl(line: string): string | null {
  const match = line.match(/https?:\/\/[^\s]+/);
  return match?.[0] ?? null;
}
