import type Database from 'better-sqlite3';

import type {
  Entity,
  KnowledgeDocument,
  SQLiteAdapter,
} from '../features/knowledge-base';

interface KnowledgeDocumentRow {
  id: string;
  title: string;
  source: KnowledgeDocument['source'];
  source_id: string | null;
  content: string;
  content_type: KnowledgeDocument['contentType'];
  tags_json: string | null;
  entities_json: string | null;
  embedding_json: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray<T>(value: string | null, fallback: T[]): T[] {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

export class KnowledgeStoreSqliteAdapter implements SQLiteAdapter {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  query(sql: string, params: unknown[] = []): unknown[] {
    return this.db.prepare(sql).all(...params);
  }

  exec(sql: string, params: unknown[] = []): void {
    if (params.length === 0) {
      this.db.exec(sql);
      return;
    }

    this.db.prepare(sql).run(...params);
  }

  close(): void {
    // The SqliteStore owns the underlying database lifecycle.
  }

  listDocuments(): KnowledgeDocument[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          id,
          title,
          source,
          source_id,
          content,
          content_type,
          tags_json,
          entities_json,
          embedding_json,
          created_at,
          updated_at
        FROM knowledge_documents
        ORDER BY updated_at DESC, created_at DESC, title ASC
      `,
      )
      .all() as KnowledgeDocumentRow[];

    return rows.map((row) => this.deserializeRow(row));
  }

  saveDocument(doc: KnowledgeDocument): void {
    const transaction = this.db.transaction((document: KnowledgeDocument) => {
      this.db
        .prepare(
          `
          INSERT OR REPLACE INTO knowledge_documents (
            id,
            title,
            source,
            source_id,
            content,
            content_type,
            tags_json,
            entities_json,
            embedding_json,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          document.id,
          document.title,
          document.source,
          document.sourceId ?? null,
          document.content,
          document.contentType,
          JSON.stringify(document.metadata.tags ?? []),
          JSON.stringify(document.metadata.entities ?? []),
          document.metadata.embedding
            ? JSON.stringify(document.metadata.embedding)
            : null,
          document.metadata.createdAt,
          document.metadata.updatedAt,
        );

      this.db
        .prepare('DELETE FROM knowledge_fts WHERE document_id = ?')
        .run(document.id);

      this.db
        .prepare(
          `
          INSERT INTO knowledge_fts (document_id, title, content, source, tags)
          VALUES (?, ?, ?, ?, ?)
        `,
        )
        .run(
          document.id,
          document.title,
          document.content,
          document.source,
          (document.metadata.tags ?? []).join(','),
        );
    });

    transaction(doc);
  }

  deleteDocument(id: string): boolean {
    const transaction = this.db.transaction((documentId: string) => {
      this.db
        .prepare('DELETE FROM knowledge_fts WHERE document_id = ?')
        .run(documentId);

      return this.db
        .prepare('DELETE FROM knowledge_documents WHERE id = ?')
        .run(documentId)
        .changes > 0;
    });

    return transaction(id);
  }

  clearDocuments(): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM knowledge_fts').run();
      this.db.prepare('DELETE FROM knowledge_documents').run();
    });

    transaction();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        entities_json TEXT NOT NULL DEFAULT '[]',
        embedding_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source_updated_at
      ON knowledge_documents(source, updated_at DESC);
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        document_id UNINDEXED,
        title,
        content,
        source,
        tags,
        tokenize='unicode61'
      );
    `);

    this.rebuildFtsIndex();
  }

  private rebuildFtsIndex(): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM knowledge_fts').run();

      const rows = this.db
        .prepare(
          `
          SELECT
            id,
            title,
            content,
            source,
            tags_json
          FROM knowledge_documents
        `,
        )
        .all() as Array<{
          id: string;
          title: string;
          content: string;
          source: KnowledgeDocument['source'];
          tags_json: string | null;
        }>;

      const insert = this.db.prepare(
        `
        INSERT INTO knowledge_fts (document_id, title, content, source, tags)
        VALUES (?, ?, ?, ?, ?)
      `,
      );

      for (const row of rows) {
        insert.run(
          row.id,
          row.title,
          row.content,
          row.source,
          parseJsonArray<string>(row.tags_json, []).join(','),
        );
      }
    });

    transaction();
  }

  private deserializeRow(row: KnowledgeDocumentRow): KnowledgeDocument {
    const tags = parseJsonArray<string>(row.tags_json, []);
    const entities = parseJsonArray<Entity>(row.entities_json, []);
    const embedding = parseJsonArray<number>(row.embedding_json, []);

    return {
      id: row.id,
      title: row.title,
      source: row.source,
      sourceId: row.source_id ?? undefined,
      content: row.content,
      contentType: row.content_type,
      metadata: {
        tags,
        entities,
        embedding,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  }
}
