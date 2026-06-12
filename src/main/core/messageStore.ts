import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

import type {
  CoworkImportedMessageInput,
  CoworkMessage,
  CoworkMessageMetadata,
  CoworkMessageType,
} from '../coworkStoreTypes';

interface CoworkMessageRow {
  id: string;
  type: string;
  content: string;
  metadata: string | null;
  created_at: number;
  sequence: number | null;
}

function parseMessageMetadata(
  sessionId: string,
  row: CoworkMessageRow,
): Record<string, unknown> | undefined {
  if (!row.metadata) {
    return undefined;
  }
  try {
    return JSON.parse(row.metadata);
  } catch {
    console.warn(
      `[CoworkStore] corrupt metadata detected for message ${row.id} in session ${sessionId}, discarding metadata`,
    );
    return undefined;
  }
}

function serializeMessageMetadata(
  metadata?: CoworkMessageMetadata,
): string | null {
  return metadata ? JSON.stringify(metadata) : null;
}

function normalizeImportedMessage(
  message: CoworkImportedMessageInput | CoworkMessageRow,
): {
  id: string;
  type: string;
  content: string;
  metadata: string | null;
  timestamp: number;
} {
  if ('created_at' in message) {
    return {
      id: message.id,
      type: message.type,
      content: message.content,
      metadata: message.metadata || null,
      timestamp: message.created_at,
    };
  }
  return {
    id: message.id,
    type: message.type,
    content: message.content,
    metadata: serializeMessageMetadata(message.metadata),
    timestamp: message.timestamp,
  };
}

export class MessageStore {
  constructor(private db: Database.Database) {}

  listSessionMessages(sessionId: string): CoworkMessage[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, type, content, metadata, created_at, sequence
      FROM cowork_messages
      WHERE session_id = ?
      ORDER BY
        COALESCE(sequence, created_at) ASC,
        created_at ASC,
        ROWID ASC
    `,
      )
      .all(sessionId) as CoworkMessageRow[];

    return rows.map((row) => ({
      id: row.id,
      type: row.type as CoworkMessageType,
      content: row.content,
      timestamp: row.created_at,
      metadata: parseMessageMetadata(sessionId, row),
    }));
  }

  addMessage(
    sessionId: string,
    message: Omit<CoworkMessage, 'id' | 'timestamp'>,
  ): CoworkMessage {
    const id = uuidv4();
    const now = Date.now();

    const seqRow = this.db
      .prepare(
        'SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM cowork_messages WHERE session_id = ?',
      )
      .get(sessionId) as { next_seq: number } | undefined;
    const sequence = seqRow?.next_seq ?? 1;

    this.db
      .prepare(
        `
      INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        sessionId,
        message.type,
        message.content,
        serializeMessageMetadata(message.metadata),
        now,
        sequence,
      );

    this.db
      .prepare('UPDATE cowork_sessions SET updated_at = ? WHERE id = ?')
      .run(now, sessionId);

    return {
      id,
      type: message.type,
      content: message.content,
      timestamp: now,
      metadata: message.metadata,
    };
  }

  insertMessageBeforeId(
    sessionId: string,
    beforeMessageId: string,
    message: Omit<CoworkMessage, 'id' | 'timestamp'>,
  ): CoworkMessage {
    const id = uuidv4();
    const now = Date.now();

    const targetRow = this.db
      .prepare('SELECT sequence FROM cowork_messages WHERE id = ? AND session_id = ?')
      .get(beforeMessageId, sessionId) as { sequence: number } | undefined;
    const targetSequence = targetRow?.sequence;

    if (targetSequence === undefined) {
      return this.addMessage(sessionId, message);
    }

    this.db.transaction(() => {
      this.db
        .prepare(
          'UPDATE cowork_messages SET sequence = sequence + 1 WHERE session_id = ? AND sequence >= ?',
        )
        .run(sessionId, targetSequence);

      this.db
        .prepare(
          `
        INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          id,
          sessionId,
          message.type,
          message.content,
          serializeMessageMetadata(message.metadata),
          now,
          targetSequence,
        );

      this.db
        .prepare('UPDATE cowork_sessions SET updated_at = ? WHERE id = ?')
        .run(now, sessionId);
    })();

    return {
      id,
      type: message.type,
      content: message.content,
      timestamp: now,
      metadata: message.metadata,
    };
  }

  deleteMessage(sessionId: string, messageId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM cowork_messages WHERE id = ? AND session_id = ?')
      .run(messageId, sessionId);
    return result.changes > 0;
  }

  replaceConversationMessages(
    sessionId: string,
    authoritative: Array<{ role: 'user' | 'assistant'; text: string }>,
  ): void {
    const now = Date.now();

    this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM cowork_messages WHERE session_id = ? AND type IN ('user', 'assistant')")
        .run(sessionId);

      const seqRow = this.db
        .prepare(
          'SELECT COALESCE(MAX(sequence), 0) as max_seq FROM cowork_messages WHERE session_id = ?',
        )
        .get(sessionId) as { max_seq: number } | undefined;
      let nextSeq = (seqRow?.max_seq ?? 0) + 1;

      for (const entry of authoritative) {
        const id = uuidv4();
        this.db
          .prepare(
            `
          INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            id,
            sessionId,
            entry.role,
            entry.text,
            JSON.stringify({ isStreaming: false, isFinal: true }),
            now,
            nextSeq++,
          );
      }

      this.db
        .prepare('UPDATE cowork_sessions SET updated_at = ? WHERE id = ?')
        .run(now, sessionId);
    })();
  }

  replaceImportedSessionMessages(
    sessionId: string,
    messages: CoworkImportedMessageInput[],
  ): boolean {
    const existing = this.db
      .prepare(
        `
      SELECT id, type, content, metadata, created_at, sequence
      FROM cowork_messages
      WHERE session_id = ?
      ORDER BY COALESCE(sequence, created_at) ASC, created_at ASC, ROWID ASC
    `,
      )
      .all(sessionId) as CoworkMessageRow[];

    const before = existing.map(normalizeImportedMessage);
    const after = messages.map(normalizeImportedMessage);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return false;
    }

    this.db.transaction(() => {
      this.db.prepare('DELETE FROM cowork_messages WHERE session_id = ?').run(sessionId);

      let sequence = 1;
      for (const message of messages) {
        this.db
          .prepare(
            `
          INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            message.id,
            sessionId,
            message.type,
            message.content,
            serializeMessageMetadata(message.metadata),
            message.timestamp,
            sequence++,
          );
      }

      const latestTimestamp = messages.reduce(
        (max, message) => Math.max(max, message.timestamp),
        0,
      );
      if (latestTimestamp > 0) {
        this.db
          .prepare('UPDATE cowork_sessions SET updated_at = ? WHERE id = ?')
          .run(latestTimestamp, sessionId);
      }
    })();

    return true;
  }

  updateMessage(
    sessionId: string,
    messageId: string,
    updates: { content?: string; metadata?: CoworkMessageMetadata },
  ): void {
    const setClauses: string[] = [];
    const values: (string | null)[] = [];

    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      values.push(updates.content);
    }
    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      values.push(serializeMessageMetadata(updates.metadata));
    }

    if (setClauses.length === 0) return;

    values.push(messageId);
    values.push(sessionId);
    this.db
      .prepare(
        `
      UPDATE cowork_messages
      SET ${setClauses.join(', ')}
      WHERE id = ? AND session_id = ?
    `,
      )
      .run(...values);
  }
}
