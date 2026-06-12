import Database from 'better-sqlite3';
import { afterEach, expect, test } from 'vitest';

import { MessageStore as MainMessageStore } from '../main/core/messageStore';
import { MessageStore } from './MessageStore';

const dbs: Database.Database[] = [];

const createDb = (): Database.Database => {
  const db = new Database(':memory:');
  dbs.push(db);

  db.exec(`
    CREATE TABLE cowork_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      claude_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      pinned INTEGER NOT NULL DEFAULT 0,
      cwd TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      execution_mode TEXT NOT NULL DEFAULT 'local',
      active_skill_ids TEXT,
      agent_id TEXT NOT NULL DEFAULT 'main',
      session_kind TEXT NOT NULL DEFAULT 'single',
      parent_session_id TEXT,
      team_id TEXT,
      runtime_snapshot_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE cowork_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      sequence INTEGER,
      FOREIGN KEY (session_id) REFERENCES cowork_sessions(id) ON DELETE CASCADE
    );
  `);

  db.prepare(`
    INSERT INTO cowork_sessions (
      id, title, claude_session_id, status, pinned, cwd, system_prompt,
      execution_mode, active_skill_ids, agent_id, session_kind,
      parent_session_id, team_id, runtime_snapshot_json, created_at, updated_at
    ) VALUES (?, ?, NULL, 'idle', 0, ?, '', 'local', '[]', 'main', 'single', NULL, NULL, NULL, ?, ?)
  `).run('session-1', 'Test Session', process.cwd(), Date.now(), Date.now());

  return db;
};

afterEach(() => {
  while (dbs.length > 0) {
    dbs.pop()?.close();
  }
});

test('core MessageStore re-exports the main SQLite implementation', () => {
  expect(MessageStore).toBe(MainMessageStore);
});

test('core MessageStore persists and reads messages through SQLite', () => {
  const db = createDb();
  const store = new MessageStore(db);

  const created = store.addMessage('session-1', {
    type: 'assistant',
    content: 'hello from sqlite',
    metadata: {
      isFinal: true,
    },
  });

  expect(created.type).toBe('assistant');
  expect(store.listSessionMessages('session-1')).toMatchObject([
    {
      id: created.id,
      type: 'assistant',
      content: 'hello from sqlite',
      metadata: {
        isFinal: true,
      },
    },
  ]);
});
