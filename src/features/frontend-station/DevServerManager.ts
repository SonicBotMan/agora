/**
 * DevServerManager — dev server lifecycle management.
 *
 * Manages create / start / stop / restart for frontend dev servers
 * backed by child processes. Emits lifecycle events so the UI layer
 * can react to state changes and HMR updates.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

import type { DevProject, DevServerConfig, ProjectTemplate, ProjectStatus } from './types';

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
}

const DEFAULT_OPTIONS: Required<DevServerManagerOptions> = {
  defaultHost: '127.0.0.1',
  portRange: [5173, 5199],
};

// ── Manager ─────────────────────────────────────────────────────────────────

export class DevServerManager extends EventEmitter {
  private projects: Map<string, DevProject> = new Map();
  private processes: Map<string, { kill: () => void }> = new Map();
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
      // ── Skeleton: spawn dev server child process ──────────────
      // const child = spawn(project.template === 'nextjs' ? 'next' : 'vite',
      //   ['dev', '--port', String(project.port)],
      //   { cwd: project.path, stdio: ['pipe', 'pipe', 'pipe'] }
      // );
      //
      // child.on('spawn', () => { ... });
      // child.stdout.on('data', (data) => {
      //   if (data.toString().includes('ready in')) {
      //     project.status = 'running';
      //     this.emit('server-ready', projectId, this.getPreviewUrl(projectId));
      //   }
      // });
      // child.on('exit', (code) => {
      //   project.status = 'stopped';
      //   this.processes.delete(projectId);
      //   this.emit('server-stopped', projectId);
      // });
      // child.on('error', (err) => {
      //   project.status = 'error';
      //   this.emit('server-error', projectId, err);
      // });
      //
      // this.processes.set(projectId, { kill: () => child.kill() });

      // Simulated async start for skeleton
      await new Promise((resolve) => setTimeout(resolve, 50));
      project.status = 'running';
      this.emit('server-ready', projectId, this.getPreviewUrl(projectId));
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
}
