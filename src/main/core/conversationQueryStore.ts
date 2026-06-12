import Database from 'better-sqlite3';

import type { CoworkConversationSearchRecord } from '../coworkStoreTypes';

function normalizeSearchText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractConversationSearchTerms(value: string): string[] {
  const normalized = normalizeSearchText(value).toLowerCase();
  if (!normalized) return [];

  const terms: string[] = [];
  const seen = new Set<string>();
  const addTerm = (term: string): void => {
    const normalizedTerm = normalizeSearchText(term).toLowerCase();
    if (!normalizedTerm) return;
    if (/^[a-z0-9]$/i.test(normalizedTerm)) return;
    if (seen.has(normalizedTerm)) return;
    seen.add(normalizedTerm);
    terms.push(normalizedTerm);
  };

  addTerm(normalized);
  const tokens = normalized
    .split(/[\s,，、|/\\;；]+/g)
    .map((token) => token.replace(/^['"`]+|['"`]+$/g, '').trim())
    .filter(Boolean);

  for (const token of tokens) {
    addTerm(token);
    if (terms.length >= 8) break;
  }

  return terms.slice(0, 8);
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}…`;
}

function parseTimeToMs(input?: string | null): number | null {
  if (!input) return null;
  const timestamp = Date.parse(input);
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

export class ConversationQueryStore {
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

  private getLatestMessageByType(sessionId: string, type: 'user' | 'assistant'): string {
    const row = this.getOne<{ content: string }>(
      `
      SELECT content
      FROM cowork_messages
      WHERE session_id = ? AND type = ?
      ORDER BY created_at DESC, ROWID DESC
      LIMIT 1
    `,
      [sessionId, type],
    );
    return truncate((row?.content || '').replace(/\s+/g, ' ').trim(), 280);
  }

  conversationSearch(options: {
    query: string;
    maxResults?: number;
    before?: string;
    after?: string;
  }): CoworkConversationSearchRecord[] {
    const terms = extractConversationSearchTerms(options.query);
    if (terms.length === 0) return [];

    const maxResults = Math.max(1, Math.min(10, Math.floor(options.maxResults ?? 5)));
    const beforeMs = parseTimeToMs(options.before);
    const afterMs = parseTimeToMs(options.after);

    const likeClauses = terms.map(() => 'LOWER(m.content) LIKE ?');
    const clauses: string[] = ["m.type IN ('user', 'assistant')", `(${likeClauses.join(' OR ')})`];
    const params: Array<string | number> = terms.map(term => `%${term}%`);

    if (beforeMs !== null) {
      clauses.push('m.created_at < ?');
      params.push(beforeMs);
    }
    if (afterMs !== null) {
      clauses.push('m.created_at > ?');
      params.push(afterMs);
    }

    const rows = this.getAll<{
      session_id: string;
      title: string;
      updated_at: number;
      type: string;
      content: string;
      created_at: number;
    }>(
      `
      SELECT m.session_id, s.title, s.updated_at, m.type, m.content, m.created_at
      FROM cowork_messages m
      INNER JOIN cowork_sessions s ON s.id = m.session_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY m.created_at DESC
      LIMIT ?
    `,
      [...params, maxResults * 40],
    );

    const bySession = new Map<string, CoworkConversationSearchRecord>();
    for (const row of rows) {
      if (!row.session_id) continue;
      let current = bySession.get(row.session_id);
      if (!current) {
        current = {
          sessionId: row.session_id,
          title: row.title || 'Untitled',
          updatedAt: Number(row.updated_at) || 0,
          url: `https://claude.ai/chat/${row.session_id}`,
          human: '',
          assistant: '',
        };
        bySession.set(row.session_id, current);
      }

      const snippet = truncate((row.content || '').replace(/\s+/g, ' ').trim(), 280);
      if (row.type === 'user' && !current.human) {
        current.human = snippet;
      }
      if (row.type === 'assistant' && !current.assistant) {
        current.assistant = snippet;
      }

      if (bySession.size >= maxResults) {
        const complete = Array.from(bySession.values()).every(
          entry => entry.human && entry.assistant,
        );
        if (complete) break;
      }
    }

    return Array.from(bySession.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, maxResults)
      .map(entry => ({
        ...entry,
        human: entry.human || this.getLatestMessageByType(entry.sessionId, 'user'),
        assistant: entry.assistant || this.getLatestMessageByType(entry.sessionId, 'assistant'),
      }));
  }

  recentChats(options: {
    n?: number;
    sortOrder?: 'asc' | 'desc';
    before?: string;
    after?: string;
  }): CoworkConversationSearchRecord[] {
    const n = Math.max(1, Math.min(20, Math.floor(options.n ?? 3)));
    const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc';
    const beforeMs = parseTimeToMs(options.before);
    const afterMs = parseTimeToMs(options.after);

    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (beforeMs !== null) {
      clauses.push('updated_at < ?');
      params.push(beforeMs);
    }
    if (afterMs !== null) {
      clauses.push('updated_at > ?');
      params.push(afterMs);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = this.getAll<{
      id: string;
      title: string;
      updated_at: number;
    }>(
      `
      SELECT id, title, updated_at
      FROM cowork_sessions
      ${whereClause}
      ORDER BY updated_at ${sortOrder.toUpperCase()}
      LIMIT ?
    `,
      [...params, n],
    );

    return rows.map(row => ({
      sessionId: row.id,
      title: row.title || 'Untitled',
      updatedAt: Number(row.updated_at) || 0,
      url: `https://claude.ai/chat/${row.id}`,
      human: this.getLatestMessageByType(row.id, 'user'),
      assistant: this.getLatestMessageByType(row.id, 'assistant'),
    }));
  }
}
