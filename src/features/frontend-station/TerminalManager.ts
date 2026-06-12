import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import type { TerminalSession } from './types';

// ── Output callback ─────────────────────────────────────────────────────────

export type TerminalOutputCallback = (data: string) => void;

export interface TerminalExitEventPayload {
  sessionId: string;
  projectId: string;
  exitCode: number | null;
}

export interface TerminalOutputEventPayload {
  sessionId: string;
  projectId: string;
  data: string;
}

type TerminalPtyProcess = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (event: { exitCode: number; signal?: number }) => void) => void;
};

export interface TerminalManagerOptions {
  spawnTerminal?: (
    shell: string,
    args: string[],
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: Record<string, string>;
    },
  ) => TerminalPtyProcess;
  shell?: string;
  env?: NodeJS.ProcessEnv;
  initialCols?: number;
  initialRows?: number;
}

// ── Manager ─────────────────────────────────────────────────────────────────

export class TerminalManager extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private outputCallbacks: Map<string, TerminalOutputCallback> = new Map();
  private processes: Map<string, TerminalPtyProcess> = new Map();
  private buffers: Map<string, string> = new Map();
  private options: Required<
    Pick<TerminalManagerOptions, 'spawnTerminal' | 'initialCols' | 'initialRows'>
  > & Pick<TerminalManagerOptions, 'shell' | 'env'>;

  constructor(options: TerminalManagerOptions = {}) {
    super();
    this.options = {
      spawnTerminal: options.spawnTerminal ?? defaultSpawnTerminal,
      shell: options.shell,
      env: options.env,
      initialCols: options.initialCols ?? 100,
      initialRows: options.initialRows ?? 28,
    };
  }

  /**
   * Create a new terminal session for a project.
   */
  createSession(projectId: string, cwd: string): TerminalSession {
    const sessionId = randomUUID();
    const shell = this.options.shell ?? resolveShell();

    const session: TerminalSession = {
      sessionId,
      projectId,
      cwd,
      shell,
      status: 'running',
      exitCode: null,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);
    this.buffers.set(sessionId, '');

    const ptyProcess = this.options.spawnTerminal(shell, [], {
      name: 'xterm-color',
      cols: this.options.initialCols,
      rows: this.options.initialRows,
      cwd,
      env: buildTerminalEnvironment(this.options.env),
    });

    ptyProcess.onData((data) => {
      this.appendToBuffer(sessionId, data);
      this.outputCallbacks.get(sessionId)?.(data);
      this.emit('terminal-output', {
        sessionId,
        projectId,
        data,
      } satisfies TerminalOutputEventPayload);
    });

    ptyProcess.onExit((event) => {
      const currentSession = this.sessions.get(sessionId);
      if (currentSession) {
        currentSession.status = 'exited';
        currentSession.exitCode = event.exitCode ?? null;
      }
      this.processes.delete(sessionId);
      this.emit('terminal-exit', {
        sessionId,
        projectId,
        exitCode: event.exitCode ?? null,
      } satisfies TerminalExitEventPayload);
    });

    this.processes.set(sessionId, ptyProcess);

    return { ...session };
  }

  /**
   * Write data to a terminal session's stdin.
   */
  write(sessionId: string, data: string): void {
    const proc = this.processes.get(sessionId);
    if (!proc) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }
    proc.write(data);
  }

  /**
   * Resize the terminal session.
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const proc = this.processes.get(sessionId);
    if (!proc) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }
    proc.resize(cols, rows);
  }

  /**
   * Destroy a terminal session and kill the underlying process.
   */
  destroySession(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill();
      this.processes.delete(sessionId);
    }
    this.outputCallbacks.delete(sessionId);
    this.buffers.delete(sessionId);
    this.sessions.delete(sessionId);
  }

  /**
   * Register an output callback for a terminal session.
   */
  onOutput(sessionId: string, callback: TerminalOutputCallback): void {
    this.outputCallbacks.set(sessionId, callback);
  }

  /**
   * Remove the output callback for a session.
   */
  offOutput(sessionId: string): void {
    this.outputCallbacks.delete(sessionId);
  }

  /**
   * Get the session metadata.
   */
  getSession(sessionId: string): TerminalSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  /**
   * List all active sessions.
   */
  getSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).map((session) => ({ ...session }));
  }

  /**
   * List all sessions for a given project.
   */
  getSessionsByProject(projectId: string): TerminalSession[] {
    return this.getSessions().filter((s) => s.projectId === projectId);
  }

  getBuffer(sessionId: string): string {
    return this.buffers.get(sessionId) ?? '';
  }

  private appendToBuffer(sessionId: string, data: string): void {
    const current = this.buffers.get(sessionId) ?? '';
    const next = `${current}${data}`;
    const maxLength = 100_000;
    this.buffers.set(
      sessionId,
      next.length > maxLength ? next.slice(next.length - maxLength) : next,
    );
  }
}

function resolveShell(): string {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'powershell.exe';
  }

  return process.env.SHELL || '/bin/bash';
}

function buildTerminalEnvironment(
  env: NodeJS.ProcessEnv | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env ?? process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function defaultSpawnTerminal(
  shell: string,
  args: string[],
  options: {
    name: string;
    cols: number;
    rows: number;
    cwd: string;
    env: Record<string, string>;
  },
): TerminalPtyProcess {
  const nodePty = require('node-pty') as typeof import('node-pty');
  return nodePty.spawn(shell, args, options);
}
