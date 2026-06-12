import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockAppPath = '/tmp/agora-app';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => mockAppPath,
    getPath: (name: string) => {
      if (name === 'userData') return '/tmp/agora-user-data';
      return '/tmp';
    },
  },
}));

import { SqliteStore } from './sqliteStore';
import { USER_MEMORIES_MIGRATION_KEY } from './sqliteStoreSupport';

describe('sqliteStore', () => {
  const stores: SqliteStore[] = [];
  let tempRoot: string;
  let userDataPath: string;
  let appPath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-sqlite-store-'));
    userDataPath = path.join(tempRoot, 'user-data');
    appPath = path.join(tempRoot, 'app');
    mockAppPath = appPath;
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.mkdirSync(appPath, { recursive: true });
  });

  afterEach(() => {
    while (stores.length > 0) {
      stores.pop()?.close();
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('migrates legacy electron-store data before marking memory migration complete', () => {
    fs.writeFileSync(
      path.join(userDataPath, 'config.json'),
      JSON.stringify({
        theme: 'dark',
        language: 'zh',
      }),
    );

    const store = SqliteStore.create(userDataPath);
    stores.push(store);

    expect(store.get('theme')).toBe('dark');
    expect(store.get('language')).toBe('zh');
    expect(store.get(USER_MEMORIES_MIGRATION_KEY)).toBe('1');
  });

  it('migrates legacy MEMORY.md entries into user_memories without duplicates', () => {
    fs.writeFileSync(
      path.join(appPath, 'MEMORY.md'),
      `
- remembers favorite editor is Cursor
- remembers favorite editor is cursor
- likes deterministic tests
      `,
    );

    const store = SqliteStore.create(userDataPath);
    stores.push(store);

    const memories = store
      .getDatabase()
      .prepare('SELECT text FROM user_memories ORDER BY text ASC')
      .all() as Array<{ text: string }>;

    expect(memories).toEqual([
      { text: 'likes deterministic tests' },
      { text: 'remembers favorite editor is Cursor' },
    ]);
    expect(store.get(USER_MEMORIES_MIGRATION_KEY)).toBe('1');
  });

  it('stores kv values and emits change notifications for set/delete', () => {
    const store = SqliteStore.create(userDataPath);
    stores.push(store);
    const events: Array<{ next: unknown; prev: unknown }> = [];

    const dispose = store.onDidChange('theme', (next, prev) => {
      events.push({ next, prev });
    });

    store.set('theme', 'dark');
    store.set('theme', 'light');
    store.delete('theme');
    dispose();

    expect(events).toEqual([
      { next: 'dark', prev: undefined },
      { next: 'light', prev: 'dark' },
      { next: undefined, prev: 'light' },
    ]);
    expect(store.get('theme')).toBeUndefined();
  });
});
