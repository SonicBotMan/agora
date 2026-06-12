import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

import {
  CoworkSessionKind,
  type CoworkSessionKind as CoworkSessionKindType,
  isCoworkSessionKind,
} from '../../shared/cowork/constants';
import type { CoworkSessionRuntimeSnapshot } from '../../shared/cowork/runtimeSnapshot';
import type {
  CoworkExecutionMode,
  CoworkImportedSessionInput,
  CoworkSession,
  CoworkSessionSummary,
} from '../coworkStoreTypes';
import { MessageStore } from './messageStore';
import {
  type CwdRow,
  hasImportedSessionChanged,
  type ImportedSessionRow,
  mapSessionRow,
  mapSessionSummaryRow,
  normalizeImportedSession,
  normalizeRecentWorkspacePath,
  type SessionRow,
  type SessionSummaryRow,
} from './sessionManagerSupport';

export interface SessionManagerDeps {
  messageStore: MessageStore;
  beforeDeleteSession?: (sessionId: string) => void;
  afterDeleteSessions?: () => void;
}

export class SessionManager {
  constructor(
    private db: Database.Database,
    private deps: SessionManagerDeps,
  ) {}

  private getOne<T>(
    sql: string,
    params: (string | number | null)[] = [],
  ): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  private getAll<T>(
    sql: string,
    params: (string | number | null)[] = [],
  ): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  createSession(
    title: string,
    cwd: string,
    systemPrompt: string = '',
    executionMode: CoworkExecutionMode = 'local',
    activeSkillIds: string[] = [],
    agentId: string = 'main',
    options: {
      sessionKind?: CoworkSessionKindType;
      parentSessionId?: string | null;
      teamId?: string | null;
      runtimeSnapshot?: CoworkSessionRuntimeSnapshot | null;
    } = {},
  ): CoworkSession {
    const id = uuidv4();
    const now = Date.now();
    const sessionKind = isCoworkSessionKind(options.sessionKind)
      ? options.sessionKind
      : CoworkSessionKind.Single;
    const parentSessionId = options.parentSessionId || null;
    const teamId = options.teamId || null;
    const runtimeSnapshot = options.runtimeSnapshot ?? null;
    const runtimeSnapshotJson = runtimeSnapshot
      ? JSON.stringify(runtimeSnapshot)
      : null;

    this.db
      .prepare(
        `
      INSERT INTO cowork_sessions (id, title, claude_session_id, status, cwd, system_prompt, execution_mode, active_skill_ids, agent_id, session_kind, parent_session_id, team_id, runtime_snapshot_json, pinned, created_at, updated_at)
      VALUES (?, ?, NULL, 'idle', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `,
      )
      .run(
        id,
        title,
        cwd,
        systemPrompt,
        executionMode,
        JSON.stringify(activeSkillIds),
        agentId,
        sessionKind,
        parentSessionId,
        teamId,
        runtimeSnapshotJson,
        now,
        now,
      );

    return {
      id,
      title,
      claudeSessionId: null,
      status: 'idle',
      pinned: false,
      cwd,
      systemPrompt,
      executionMode,
      activeSkillIds,
      agentId,
      sessionKind,
      parentSessionId,
      teamId,
      runtimeSnapshot,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  getSession(id: string): CoworkSession | null {
    const row = this.getOne<SessionRow>(
      `
      SELECT id, title, claude_session_id, status, pinned, cwd, system_prompt, execution_mode, active_skill_ids, agent_id, session_kind, parent_session_id, team_id, runtime_snapshot_json, created_at, updated_at
      FROM cowork_sessions
      WHERE id = ?
    `,
      [id],
    );

    if (!row) return null;

    return mapSessionRow(
      row,
      this.deps.messageStore.listSessionMessages(id),
    );
  }

  updateSession(
    id: string,
    updates: Partial<
      Pick<
        CoworkSession,
        | 'title'
        | 'claudeSessionId'
        | 'status'
        | 'cwd'
        | 'systemPrompt'
        | 'executionMode'
        | 'runtimeSnapshot'
      >
    >,
  ): void {
    const now = Date.now();
    const setClauses: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      values.push(updates.title);
    }
    if (updates.claudeSessionId !== undefined) {
      setClauses.push('claude_session_id = ?');
      values.push(updates.claudeSessionId);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.cwd !== undefined) {
      setClauses.push('cwd = ?');
      values.push(updates.cwd);
    }
    if (updates.systemPrompt !== undefined) {
      setClauses.push('system_prompt = ?');
      values.push(updates.systemPrompt);
    }
    if (updates.executionMode !== undefined) {
      setClauses.push('execution_mode = ?');
      values.push(updates.executionMode);
    }
    if (updates.runtimeSnapshot !== undefined) {
      setClauses.push('runtime_snapshot_json = ?');
      values.push(
        updates.runtimeSnapshot
          ? JSON.stringify(updates.runtimeSnapshot)
          : null,
      );
    }

    values.push(id);
    this.db
      .prepare(
        `
      UPDATE cowork_sessions
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `,
      )
      .run(...values);
  }

  deleteSession(id: string): void {
    this.deps.beforeDeleteSession?.(id);
    this.db.prepare('DELETE FROM cowork_sessions WHERE id = ?').run(id);
    this.deps.afterDeleteSessions?.();
  }

  deleteSessions(ids: string[]): void {
    if (ids.length === 0) return;
    for (const id of ids) {
      this.deps.beforeDeleteSession?.(id);
    }
    const placeholders = ids.map(() => '?').join(',');
    this.db
      .prepare(`DELETE FROM cowork_sessions WHERE id IN (${placeholders})`)
      .run(...ids);
    this.deps.afterDeleteSessions?.();
  }

  setSessionPinned(id: string, pinned: boolean): void {
    this.db
      .prepare('UPDATE cowork_sessions SET pinned = ? WHERE id = ?')
      .run(pinned ? 1 : 0, id);
  }

  listSessions(agentId?: string): CoworkSessionSummary[] {
    let rows: SessionSummaryRow[];
    if (agentId) {
      rows = this.getAll<SessionSummaryRow>(
        `
        SELECT id, title, status, pinned, agent_id, session_kind, parent_session_id, team_id, runtime_snapshot_json, created_at, updated_at
        FROM cowork_sessions
        WHERE agent_id = ?
          AND COALESCE(session_kind, 'single') != ?
        ORDER BY pinned DESC, updated_at DESC
      `,
        [agentId, CoworkSessionKind.TeamChild],
      );
    } else {
      rows = this.getAll<SessionSummaryRow>(`
        SELECT id, title, status, pinned, agent_id, session_kind, parent_session_id, team_id, runtime_snapshot_json, created_at, updated_at
        FROM cowork_sessions
        WHERE COALESCE(session_kind, 'single') != '${CoworkSessionKind.TeamChild}'
        ORDER BY pinned DESC, updated_at DESC
      `);
    }

    return rows.map(mapSessionSummaryRow);
  }

  resetRunningSessions(): number {
    const now = Date.now();
    const result = this.db
      .prepare(
        `
      UPDATE cowork_sessions
      SET status = 'idle', updated_at = ?
      WHERE status = 'running'
    `,
      )
      .run(now);
    return result.changes;
  }

  listRecentCwds(limit: number = 8): string[] {
    const rows = this.getAll<CwdRow>(
      `
      SELECT cwd, updated_at
      FROM cowork_sessions
      WHERE cwd IS NOT NULL AND TRIM(cwd) != ''
      ORDER BY updated_at DESC
      LIMIT ?
    `,
      [Math.max(limit * 8, limit)],
    );

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const normalized = normalizeRecentWorkspacePath(row.cwd);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      deduped.push(normalized);
      if (deduped.length >= limit) {
        break;
      }
    }

    return deduped;
  }

  upsertImportedSession(input: CoworkImportedSessionInput): boolean {
    const normalized = normalizeImportedSession(input);
    const existing = this.getOne<ImportedSessionRow>(
      `
      SELECT title, claude_session_id, status, cwd, system_prompt, execution_mode, active_skill_ids, agent_id, session_kind, parent_session_id, team_id, runtime_snapshot_json, created_at, updated_at
      FROM cowork_sessions
      WHERE id = ?
    `,
      [input.id],
    );

    if (!existing) {
      this.db
        .prepare(
          `
        INSERT INTO cowork_sessions (id, title, claude_session_id, status, cwd, system_prompt, execution_mode, active_skill_ids, agent_id, session_kind, parent_session_id, team_id, runtime_snapshot_json, pinned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `,
        )
        .run(
          input.id,
          input.title,
          input.claudeSessionId,
          input.status,
          input.cwd,
          input.systemPrompt,
          input.executionMode,
          normalized.activeSkillIdsJson,
          input.agentId,
          normalized.sessionKind,
          normalized.parentSessionId,
          normalized.teamId,
          normalized.runtimeSnapshotJson,
          input.createdAt,
          input.updatedAt,
        );
      return true;
    }

    const changed = hasImportedSessionChanged(existing, input, normalized);

    if (!changed) return false;

    this.db
      .prepare(
        `
      UPDATE cowork_sessions
      SET title = ?,
          claude_session_id = ?,
          status = ?,
          cwd = ?,
          system_prompt = ?,
          execution_mode = ?,
          active_skill_ids = ?,
          agent_id = ?,
          session_kind = ?,
          parent_session_id = ?,
          team_id = ?,
          runtime_snapshot_json = ?,
          created_at = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(
        input.title,
        input.claudeSessionId,
        input.status,
        input.cwd,
        input.systemPrompt,
        input.executionMode,
        normalized.activeSkillIdsJson,
        input.agentId,
        normalized.sessionKind,
        normalized.parentSessionId,
        normalized.teamId,
        normalized.runtimeSnapshotJson,
        input.createdAt,
        input.updatedAt,
        input.id,
      );
    return true;
  }
}
