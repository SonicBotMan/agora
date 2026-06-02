/**
 * TerminalManager — xterm.js terminal session management.
 *
 * Skeleton implementation. Each terminal session is backed by a
 * pseudo-terminal (node-pty) child process. The consuming layer
 * is responsible for mounting xterm.js into the DOM and forwarding
 * I/O events.
 */

import { randomUUID } from 'crypto';

import type { TerminalSession } from './types';

// ── Output callback ─────────────────────────────────────────────────────────

export type TerminalOutputCallback = (data: string) => void;

// ── Manager ─────────────────────────────────────────────────────────────────

export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private outputCallbacks: Map<string, TerminalOutputCallback> = new Map();
  private processes: Map<string, { write: (data: string) => void; resize: (cols: number, rows: number) => void; kill: () => void }> = new Map();

  /**
   * Create a new terminal session for a project.
   * Returns the sessionId.
   */
  createSession(projectId: string): string {
    const sessionId = randomUUID();

    const session: TerminalSession = {
      sessionId,
      projectId,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    // ── Skeleton: spawn pty child process ───────────────────────
    // const ptyProcess = spawn('bash', [], {
    //   name: 'xterm-color',
    //   cols: 80,
    //   rows: 24,
    //   cwd: projectPath,
    //   env: process.env as Record<string, string>,
    // });
    //
    // ptyProcess.onData((data: string) => {
    //   const cb = this.outputCallbacks.get(sessionId);
    //   cb?.(data);
    // });
    //
    // this.processes.set(sessionId, {
    //   write: (data: string) => ptyProcess.write(data),
    //   resize: (cols: number, rows: number) => ptyProcess.resize(cols, rows),
    //   kill: () => ptyProcess.kill(),
    // });

    // Skeleton: no-op process stub
    this.processes.set(sessionId, {
      write: (_data: string) => {},
      resize: (_cols: number, _rows: number) => {},
      kill: () => {},
    });

    return sessionId;
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
    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions.
   */
  getSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * List all sessions for a given project.
   */
  getSessionsByProject(projectId: string): TerminalSession[] {
    return this.getSessions().filter((s) => s.projectId === projectId);
  }
}
