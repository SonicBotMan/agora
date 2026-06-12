import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

import type {
  CoworkUserMemory,
  CoworkUserMemorySourceInput,
  CoworkUserMemoryStats,
  CoworkUserMemoryStatus,
} from '../coworkStoreTypes';
import {
  buildMemoryFingerprint,
  choosePreferredMemoryText,
  MEMORY_NEAR_DUPLICATE_MIN_SCORE,
  normalizeMemorySemanticKey,
  normalizeMemoryText,
  scoreMemorySimilarity,
  shouldAutoDeleteMemoryText,
  truncate,
} from './userMemoryTextUtils';

interface CoworkUserMemoryRow {
  id: string;
  text: string;
  fingerprint: string;
  confidence: number;
  is_explicit: number;
  status: string;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

export interface CreateOrReviveUserMemoryResult {
  memory: CoworkUserMemory;
  created: boolean;
  updated: boolean;
}

export class UserMemoryRecordStore {
  constructor(private db: Database.Database) {}

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

  private mapMemoryRow(row: CoworkUserMemoryRow): CoworkUserMemory {
    return {
      id: row.id,
      text: row.text,
      confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : 0.7,
      isExplicit: Boolean(row.is_explicit),
      status: (row.status === 'stale' || row.status === 'deleted'
        ? row.status
        : 'created') as CoworkUserMemoryStatus,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      lastUsedAt: row.last_used_at === null ? null : Number(row.last_used_at),
    };
  }

  addMemorySource(memoryId: string, source?: CoworkUserMemorySourceInput): void {
    const now = Date.now();
    this.db
      .prepare(
        `
      INSERT INTO user_memory_sources (id, memory_id, session_id, message_id, role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `,
      )
      .run(
        uuidv4(),
        memoryId,
        source?.sessionId || null,
        source?.messageId || null,
        source?.role || 'system',
        now,
      );
  }

  createOrReviveUserMemory(input: {
    text: string;
    confidence?: number;
    isExplicit?: boolean;
    source?: CoworkUserMemorySourceInput;
  }): CreateOrReviveUserMemoryResult {
    const normalizedText = truncate(normalizeMemoryText(input.text), 360);
    if (!normalizedText) {
      throw new Error('Memory text is required');
    }

    const now = Date.now();
    const fingerprint = buildMemoryFingerprint(normalizedText);
    const confidence = Math.max(
      0,
      Math.min(1, Number.isFinite(input.confidence) ? Number(input.confidence) : 0.75),
    );
    const explicitFlag = input.isExplicit ? 1 : 0;

    let existing = this.getOne<CoworkUserMemoryRow>(
      `
      SELECT id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
      FROM user_memories
      WHERE fingerprint = ? AND status != 'deleted'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
      [fingerprint],
    );

    if (!existing) {
      const incomingSemanticKey = normalizeMemorySemanticKey(normalizedText);
      if (incomingSemanticKey) {
        const candidates = this.getAll<CoworkUserMemoryRow>(`
          SELECT id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
          FROM user_memories
          WHERE status != 'deleted'
          ORDER BY updated_at DESC
          LIMIT 200
        `);
        let bestCandidate: CoworkUserMemoryRow | null = null;
        let bestScore = 0;
        for (const candidate of candidates) {
          const candidateSemanticKey = normalizeMemorySemanticKey(candidate.text);
          if (!candidateSemanticKey) continue;
          const score = scoreMemorySimilarity(candidateSemanticKey, incomingSemanticKey);
          if (score <= bestScore) continue;
          bestScore = score;
          bestCandidate = candidate;
        }
        if (bestCandidate && bestScore >= MEMORY_NEAR_DUPLICATE_MIN_SCORE) {
          existing = bestCandidate;
        }
      }
    }

    if (existing) {
      const mergedText = choosePreferredMemoryText(existing.text, normalizedText);
      const mergedExplicit = existing.is_explicit ? 1 : explicitFlag;
      const mergedConfidence = Math.max(Number(existing.confidence) || 0, confidence);
      this.db
        .prepare(
          `
        UPDATE user_memories
        SET text = ?, fingerprint = ?, confidence = ?, is_explicit = ?, status = 'created', updated_at = ?
        WHERE id = ?
      `,
        )
        .run(
          mergedText,
          buildMemoryFingerprint(mergedText),
          mergedConfidence,
          mergedExplicit,
          now,
          existing.id,
        );
      this.addMemorySource(existing.id, input.source);
      const memory = this.getOne<CoworkUserMemoryRow>(
        `
        SELECT id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
        FROM user_memories
        WHERE id = ?
      `,
        [existing.id],
      );
      if (!memory) {
        throw new Error('Failed to reload updated memory');
      }
      return { memory: this.mapMemoryRow(memory), created: false, updated: true };
    }

    const id = uuidv4();
    this.db
      .prepare(
        `
      INSERT INTO user_memories (
        id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, 'created', ?, ?, NULL)
    `,
      )
      .run(id, normalizedText, fingerprint, confidence, explicitFlag, now, now);
    this.addMemorySource(id, input.source);

    const memory = this.getOne<CoworkUserMemoryRow>(
      `
      SELECT id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
      FROM user_memories
      WHERE id = ?
    `,
      [id],
    );
    if (!memory) {
      throw new Error('Failed to load created memory');
    }

    return { memory: this.mapMemoryRow(memory), created: true, updated: false };
  }

  listUserMemories(
    options: {
      query?: string;
      status?: CoworkUserMemoryStatus | 'all';
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    } = {},
  ): CoworkUserMemory[] {
    const query = normalizeMemoryText(options.query || '');
    const includeDeleted = Boolean(options.includeDeleted);
    const status = options.status || 'all';
    const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 200)));
    const offset = Math.max(0, Math.floor(options.offset ?? 0));

    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (!includeDeleted && status === 'all') {
      clauses.push(`status != 'deleted'`);
    }
    if (status !== 'all') {
      clauses.push('status = ?');
      params.push(status);
    }
    if (query) {
      clauses.push('LOWER(text) LIKE ?');
      params.push(`%${query.toLowerCase()}%`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = this.getAll<CoworkUserMemoryRow>(
      `
      SELECT id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
      FROM user_memories
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset],
    );

    return rows.map((row) => this.mapMemoryRow(row));
  }

  createUserMemory(input: {
    text: string;
    confidence?: number;
    isExplicit?: boolean;
    source?: CoworkUserMemorySourceInput;
  }): CoworkUserMemory {
    return this.createOrReviveUserMemory(input).memory;
  }

  updateUserMemory(input: {
    id: string;
    text?: string;
    confidence?: number;
    status?: CoworkUserMemoryStatus;
    isExplicit?: boolean;
  }): CoworkUserMemory | null {
    const current = this.getOne<CoworkUserMemoryRow>(
      `
      SELECT id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
      FROM user_memories
      WHERE id = ?
    `,
      [input.id],
    );
    if (!current) return null;

    const now = Date.now();
    const nextText =
      input.text !== undefined ? truncate(normalizeMemoryText(input.text), 360) : current.text;
    if (!nextText) {
      throw new Error('Memory text is required');
    }
    const nextConfidence =
      input.confidence !== undefined
        ? Math.max(0, Math.min(1, Number(input.confidence)))
        : Number(current.confidence);
    const nextStatus =
      input.status
      && (input.status === 'created' || input.status === 'stale' || input.status === 'deleted')
        ? input.status
        : current.status;
    const nextExplicit =
      input.isExplicit !== undefined ? (input.isExplicit ? 1 : 0) : current.is_explicit;

    this.db
      .prepare(
        `
      UPDATE user_memories
      SET text = ?, fingerprint = ?, confidence = ?, is_explicit = ?, status = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(
        nextText,
        buildMemoryFingerprint(nextText),
        nextConfidence,
        nextExplicit,
        nextStatus,
        now,
        input.id,
      );

    const updated = this.getOne<CoworkUserMemoryRow>(
      `
      SELECT id, text, fingerprint, confidence, is_explicit, status, created_at, updated_at, last_used_at
      FROM user_memories
      WHERE id = ?
    `,
      [input.id],
    );

    return updated ? this.mapMemoryRow(updated) : null;
  }

  deleteUserMemory(id: string): boolean {
    const now = Date.now();
    const memResult = this.db
      .prepare(
        `
      UPDATE user_memories
      SET status = 'deleted', updated_at = ?
      WHERE id = ?
    `,
      )
      .run(now, id);
    this.db
      .prepare(
        `
      UPDATE user_memory_sources
      SET is_active = 0
      WHERE memory_id = ?
    `,
      )
      .run(id);
    return memResult.changes > 0;
  }

  getUserMemoryStats(): CoworkUserMemoryStats {
    const rows = this.getAll<{
      status: string;
      is_explicit: number;
      count: number;
    }>(`
      SELECT status, is_explicit, COUNT(*) AS count
      FROM user_memories
      GROUP BY status, is_explicit
    `);

    const stats: CoworkUserMemoryStats = {
      total: 0,
      created: 0,
      stale: 0,
      deleted: 0,
      explicit: 0,
      implicit: 0,
    };

    for (const row of rows) {
      const count = Number(row.count) || 0;
      stats.total += count;
      if (row.status === 'created') stats.created += count;
      if (row.status === 'stale') stats.stale += count;
      if (row.status === 'deleted') stats.deleted += count;
      if (row.is_explicit) stats.explicit += count;
      else stats.implicit += count;
    }

    return stats;
  }

  autoDeleteNonPersonalMemories(): number {
    const rows = this.getAll<Pick<CoworkUserMemoryRow, 'id' | 'text'>>(
      `SELECT id, text FROM user_memories WHERE status = 'created'`,
    );
    if (rows.length === 0) return 0;

    const now = Date.now();
    let deleted = 0;
    for (const row of rows) {
      if (!shouldAutoDeleteMemoryText(row.text)) {
        continue;
      }
      this.db
        .prepare(
          `
        UPDATE user_memories
        SET status = 'deleted', updated_at = ?
        WHERE id = ?
      `,
        )
        .run(now, row.id);
      this.db
        .prepare(
          `
        UPDATE user_memory_sources
        SET is_active = 0
        WHERE memory_id = ?
      `,
        )
        .run(row.id);
      deleted += 1;
    }

    return deleted;
  }

  markMemorySourcesInactiveBySession(sessionId: string): void {
    this.db
      .prepare(
        `
      UPDATE user_memory_sources
      SET is_active = 0
      WHERE session_id = ? AND is_active = 1
    `,
      )
      .run(sessionId);
  }

  markOrphanImplicitMemoriesStale(): void {
    const now = Date.now();
    this.db
      .prepare(
        `
      UPDATE user_memories
      SET status = 'stale', updated_at = ?
      WHERE is_explicit = 0
        AND status = 'created'
        AND NOT EXISTS (
          SELECT 1
          FROM user_memory_sources s
          WHERE s.memory_id = user_memories.id AND s.is_active = 1
        )
    `,
      )
      .run(now);
  }
}
