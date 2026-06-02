/**
 * SessionManager — session CRUD with in-memory Map storage.
 *
 * Provides create, read, list, and delete operations for cowork sessions.
 * Designed as a lightweight in-memory cache with an interface that can be
 * backed by persistent storage later.
 */

/**
 * SessionRecord represents a session stored in the session manager.
 */
export interface SessionRecord {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  agentId: string;
  agentEngine: string;
  cwd: string;
  systemPrompt: string;
  activeSkillIds: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Options for creating a new session.
 */
export interface CreateSessionOptions {
  id?: string;
  title: string;
  agentId: string;
  agentEngine: string;
  cwd?: string;
  systemPrompt?: string;
  activeSkillIds?: string[];
}

/**
 * SessionManager — manages session lifecycle with an in-memory Map.
 */
export class SessionManager {
  private readonly sessions: Map<string, SessionRecord> = new Map();

  /**
   * Creates a new session record and stores it in memory.
   */
  createSession(options: CreateSessionOptions): SessionRecord {
    const now = Date.now();
    const session: SessionRecord = {
      id: options.id ?? crypto.randomUUID(),
      title: options.title,
      status: 'idle',
      agentId: options.agentId,
      agentEngine: options.agentEngine,
      cwd: options.cwd ?? '',
      systemPrompt: options.systemPrompt ?? '',
      activeSkillIds: options.activeSkillIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Retrieves a session by its ID. Returns null if not found.
   */
  getSession(sessionId: string): SessionRecord | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Lists all sessions, optionally filtered by status.
   */
  listSessions(status?: 'idle' | 'running' | 'completed' | 'error'): SessionRecord[] {
    const all = Array.from(this.sessions.values());
    if (status) {
      return all.filter((s) => s.status === status);
    }
    return all;
  }

  /**
   * Deletes a session by ID. Returns true if the session existed and was removed.
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}
