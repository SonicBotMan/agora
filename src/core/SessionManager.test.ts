import Database from 'better-sqlite3';
import { afterEach, expect, test } from 'vitest';

import { SessionManager as MainSessionManager } from '../main/core/sessionManager';
import { MessageStore } from './MessageStore';
import { SessionManager } from './SessionManager';

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
      execution_mode TEXT,
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

  return db;
};

afterEach(() => {
  while (dbs.length > 0) {
    dbs.pop()?.close();
  }
});

test('core SessionManager re-exports the main SQLite implementation', () => {
  expect(SessionManager).toBe(MainSessionManager);
});

test('core SessionManager creates and reads persisted sessions', () => {
  const db = createDb();
  const messageStore = new MessageStore(db);
  const manager = new SessionManager(db, { messageStore });

  const created = manager.createSession(
    'Core Session',
    process.cwd(),
    'system prompt',
    'local',
    ['skill-a'],
    'main',
  );

  const loaded = manager.getSession(created.id);
  expect(loaded).toMatchObject({
    id: created.id,
    title: 'Core Session',
    cwd: process.cwd(),
    systemPrompt: 'system prompt',
    activeSkillIds: ['skill-a'],
    agentId: 'main',
    messages: [],
  });

  expect(manager.listSessions()).toMatchObject([
    {
      id: created.id,
      title: 'Core Session',
      agentId: 'main',
    },
  ]);
});
