/**
 * MessageStore — message persistence interface with in-memory implementation
 * and SQLite (better-sqlite3) interface design.
 *
 * Provides append, query, and delete operations for cowork messages.
 * The current implementation uses an in-memory Map for storage, with a
 * placeholder SQLite backend ready for future integration.
 */

import type { CoworkMessage } from '../main/coworkStore';

/**
 * Options for querying messages.
 */
export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
}

/**
 * SQLite-backed message store interface.
 * The actual SQLite implementation can be swapped in without changing
 * the public API surface.
 */
export interface SQLiteMessageStoreAdapter {
  /** Prepared statement cache for appending a message */
  prepareAppend(): void;
  /** Prepared statement cache for querying messages by session */
  prepareQuery(): void;
  /** Close the database connection */
  close(): void;
}

/**
 * MessageStore — message persistence layer.
 *
 * Uses an in-memory Map<sessionId, CoworkMessage[]> for storage.
 * Designed so that the backing store can be migrated to better-sqlite3
 * by replacing the internal implementation while keeping the same API.
 */
export class MessageStore {
  private readonly messagesBySession: Map<string, CoworkMessage[]> = new Map();

  /** Optional SQLite adapter for future persistence. */
  private sqliteAdapter: SQLiteMessageStoreAdapter | null = null;

  /**
   * Appends a message to the specified session's message list.
   */
  appendMessage(sessionId: string, message: CoworkMessage): void {
    const existing = this.messagesBySession.get(sessionId);
    if (existing) {
      existing.push(message);
    } else {
      this.messagesBySession.set(sessionId, [message]);
    }
  }

  /**
   * Retrieves all messages across all sessions.
   */
  getMessages(): CoworkMessage[] {
    const all: CoworkMessage[] = [];
    for (const messages of this.messagesBySession.values()) {
      all.push(...messages);
    }
    return all;
  }

  /**
   * Retrieves messages for a specific session, with optional pagination.
   */
  getMessagesBySession(sessionId: string, options?: GetMessagesOptions): CoworkMessage[] {
    const messages = this.messagesBySession.get(sessionId);
    if (!messages) {
      return [];
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? messages.length;

    return messages.slice(offset, offset + limit);
  }

  /**
   * Deletes all messages for a given session. Returns true if any messages were removed.
   */
  deleteMessages(sessionId: string): boolean {
    return this.messagesBySession.delete(sessionId);
  }

  // --- SQLite adapter hooks (reserved for future use) ---

  /**
   * Binds a SQLite adapter for persistent storage.
   * When bound, operations will be mirrored to the database.
   */
  bindSQLiteAdapter(adapter: SQLiteMessageStoreAdapter): void {
    this.sqliteAdapter = adapter;
    this.sqliteAdapter.prepareAppend();
    this.sqliteAdapter.prepareQuery();
  }

  /**
   * Unbinds the SQLite adapter and closes the connection.
   */
  unbindSQLiteAdapter(): void {
    this.sqliteAdapter?.close();
    this.sqliteAdapter = null;
  }
}
