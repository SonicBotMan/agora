import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, expect, test, vi } from 'vitest';

let mockAppPath = '/tmp/agora-core-config-app';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => mockAppPath,
  },
}));

import { ConfigManager as MainConfigManager } from '../main/core/configManager';
import {
  CoworkAgentEngine,
  DefaultCoworkAgentEngine,
} from '../shared/cowork/constants';
import { ConfigManager, normalizeCoworkAgentEngineValue } from './ConfigManager';

const dbs: Database.Database[] = [];
const tempDirs: string[] = [];

const createDb = (): Database.Database => {
  const db = new Database(':memory:');
  dbs.push(db);
  db.exec(`
    CREATE TABLE cowork_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE kv (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  return db;
};

const createMockAppPath = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-core-config-'));
  tempDirs.push(tempRoot);
  const appPath = path.join(tempRoot, 'app');
  const resourcesPath = path.join(appPath, 'resources');
  fs.mkdirSync(resourcesPath, { recursive: true });
  fs.writeFileSync(
    path.join(resourcesPath, 'SYSTEM_PROMPT.md'),
    'core system prompt',
    'utf-8',
  );
  return appPath;
};

afterEach(() => {
  while (dbs.length > 0) {
    dbs.pop()?.close();
  }
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

test('core ConfigManager re-exports the main SQLite implementation', () => {
  expect(ConfigManager).toBe(MainConfigManager);
});

test('core ConfigManager persists config values and exposes defaults from real storage', () => {
  mockAppPath = createMockAppPath();
  const db = createDb();
  const manager = new ConfigManager(db);

  manager.setConfig({
    workingDirectory: '/tmp/agora-workspace',
    agentEngine: CoworkAgentEngine.Codex,
    memoryEnabled: false,
  });
  db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)')
    .run('app_config', JSON.stringify({ language: 'en' }));

  expect(manager.getConfig()).toMatchObject({
    workingDirectory: '/tmp/agora-workspace',
    systemPrompt: 'core system prompt',
    agentEngine: CoworkAgentEngine.Codex,
    memoryEnabled: false,
  });
  expect(manager.getAppLanguage()).toBe('en');
  expect(normalizeCoworkAgentEngineValue('invalid-engine')).toBe(
    DefaultCoworkAgentEngine,
  );
});
