/**
 * KnowledgeStore — document store with an in-process cache plus optional
 * SQLite / FTS5 persistence hooks.
 *
 * Mirrors the MessageStore pattern: hot reads come from the local Map while
 * persistence and full-text indexing can be delegated to the configured adapter.
 */

import { EventEmitter } from 'events';

import type {
  FTSQuery,
  FTSResult,
  KnowledgeDocument,
  KnowledgeSource,
} from './types';

type Awaitable<T> = T | Promise<T>;

// ── SQLiteAdapter Interface ─────────────────────────────────────────────────

export interface SQLiteAdapter {
  query(sql: string, params?: unknown[]): Awaitable<unknown[]>;
  exec(sql: string, params?: unknown[]): Awaitable<void>;
  close(): Awaitable<void>;
  saveDocument?(doc: KnowledgeDocument): Awaitable<void>;
  deleteDocument?(id: string): Awaitable<boolean | void>;
  clearDocuments?(): Awaitable<void>;
}

// ── Store Events ────────────────────────────────────────────────────────────

export type KnowledgeStoreEventType =
  | 'document:saved'
  | 'document:deleted'
  | 'document:updated'
  | 'fts:indexed'
  | 'error';

export interface KnowledgeStoreEvent {
  type: KnowledgeStoreEventType;
  documentId?: string;
  timestamp: string;
  payload?: unknown;
}

// ── Store Options ───────────────────────────────────────────────────────────

export interface KnowledgeStoreOptions {
  adapter?: SQLiteAdapter;
  initialDocuments?: KnowledgeDocument[];
}

// ── Store Implementation ────────────────────────────────────────────────────

export class KnowledgeStore extends EventEmitter {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private adapter?: SQLiteAdapter;
  private ftsTableName = 'knowledge_fts';

  constructor(options: KnowledgeStoreOptions = {}) {
    super();
    this.adapter = options.adapter;
    for (const document of options.initialDocuments ?? []) {
      this.documents.set(document.id, document);
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  async save(doc: KnowledgeDocument): Promise<void> {
    const existing = this.documents.get(doc.id);
    this.documents.set(doc.id, doc);

    if (this.adapter) {
      try {
        if (this.adapter.saveDocument) {
          await this.adapter.saveDocument(doc);
        } else {
          await this.adapter.exec(
            `INSERT OR REPLACE INTO ${this.ftsTableName} (document_id, title, content, source, tags)
             VALUES (?, ?, ?, ?, ?)`,
            [doc.id, doc.title, doc.content, doc.source, doc.metadata.tags.join(',')],
          );
        }
      } catch (err) {
        this.emit('error', {
          type: 'error',
          documentId: doc.id,
          timestamp: new Date().toISOString(),
          payload: err,
        });
      }
    }

    const eventType = existing ? 'document:updated' : 'document:saved';
    (this.emit as (event: string, payload: KnowledgeStoreEvent) => void)(eventType, {
      type: eventType,
      documentId: doc.id,
      timestamp: new Date().toISOString(),
    });
  }

  async get(id: string): Promise<KnowledgeDocument | undefined> {
    return this.documents.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.documents.delete(id);

    if (existed && this.adapter) {
      try {
        if (this.adapter.deleteDocument) {
          await this.adapter.deleteDocument(id);
        } else {
          await this.adapter.exec(
            `DELETE FROM ${this.ftsTableName} WHERE document_id = ?`,
            [id],
          );
        }
      } catch (err) {
        this.emit('error', {
          type: 'error',
          documentId: id,
          timestamp: new Date().toISOString(),
          payload: err,
        });
      }
    }

    if (existed) {
      (this.emit as (event: string, payload: KnowledgeStoreEvent) => void)('document:deleted', {
        type: 'document:deleted',
        documentId: id,
        timestamp: new Date().toISOString(),
      });
    }

    return existed;
  }

  async list(offset = 0, limit = 50): Promise<KnowledgeDocument[]> {
    return this.sortedDocuments().slice(offset, offset + limit);
  }

  async count(): Promise<number> {
    return this.documents.size;
  }

  // ── Search ─────────────────────────────────────────────────────────────

  async search(
    query: string,
    options: { limit?: number; source?: KnowledgeSource } = {}
  ): Promise<KnowledgeDocument[]> {
    const { limit = 50, source } = options;
    const lower = query.toLowerCase();

    let results = Array.from(this.documents.values()).filter((doc) => {
      if (source && doc.source !== source) return false;
      return (
        doc.title.toLowerCase().includes(lower) ||
        doc.content.toLowerCase().includes(lower) ||
        doc.metadata.tags.some((t) => t.toLowerCase().includes(lower))
      );
    });

    return results.slice(0, limit);
  }

  // ── FTS5 Interface ─────────────────────────────────────────────────────

  /**
   * Build an FTS5 query string from raw user input.
   * Escapes special characters and supports prefix queries.
   */
  buildFTSQuery(input: string, options: { prefix?: boolean } = {}): FTSQuery {
    const { prefix = false } = options;

    // Normalise whitespace and split into terms
    const rawTerms = input.trim().split(/\s+/).filter(Boolean);

    // Escape FTS5 special characters and append * for prefix mode
    const terms = rawTerms.map((t) => {
      const escaped = t.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '');
      return prefix ? `${escaped}*` : escaped;
    });

    // Build the raw query string (AND by default)
    const raw = terms.map((t) => `"${t}"`).join(' ');

    return { raw, terms, prefix };
  }

  /**
   * Parse FTS5 raw result rows into structured FTSResult objects.
   */
  parseFTSResults(rows: unknown[]): FTSResult[] {
    return (rows as Array<{ rowid: number; document_id: string; rank: number; snippet?: string }>).map(
      (row) => ({
        rowid: row.rowid,
        documentId: row.document_id,
        rank: row.rank,
        snippet: row.snippet,
      })
    );
  }

  /**
   * Initialize FTS5 virtual table. Call after setting the adapter.
   */
  async initFTS(): Promise<void> {
    if (!this.adapter) return;

    await this.adapter.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${this.ftsTableName} USING fts5(
        document_id UNINDEXED,
        title,
        content,
        source,
        tags,
        tokenize='unicode61'
      )
    `);
  }

  /**
   * Purge all documents from the in-memory store and FTS table.
   */
  async clear(): Promise<void> {
    this.documents.clear();

    if (this.adapter) {
      if (this.adapter.clearDocuments) {
        await this.adapter.clearDocuments();
      } else {
        await this.adapter.exec(`DELETE FROM ${this.ftsTableName}`);
      }
    }
  }

  private sortedDocuments(): KnowledgeDocument[] {
    return Array.from(this.documents.values()).sort((left, right) => {
      const updated =
        new Date(right.metadata.updatedAt).getTime() -
        new Date(left.metadata.updatedAt).getTime();
      if (updated !== 0) {
        return updated;
      }

      const created =
        new Date(right.metadata.createdAt).getTime() -
        new Date(left.metadata.createdAt).getTime();
      if (created !== 0) {
        return created;
      }

      return left.title.localeCompare(right.title);
    });
  }
}
