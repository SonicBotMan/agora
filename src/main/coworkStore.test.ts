/**
 * Unit tests for CoworkStore – resilient metadata parsing.
 *
 * Verifies that corrupt JSON in the metadata column of cowork_messages does NOT
 * prevent a session from loading.  Valid/null metadata must still work correctly.
 *
 * Mocks the `electron` module so CoworkStore can be imported outside Electron.
 */
import { beforeEach, expect, test, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock electron so the import of coworkStore.ts succeeds in Node
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock' },
}));

// ---------------------------------------------------------------------------
// Now import the class under test
// ---------------------------------------------------------------------------
import BetterSqlite3 from 'better-sqlite3';

import {
  AgentTeamWorkflow,
  ClaudeCodePermissionMode,
  CoworkAgentEngine,
  CoworkSessionKind,
  DeepSeekTuiPermissionMode,
  ExternalAgentConfigSource,
  OpenCodePermissionMode,
} from '../shared/cowork/constants';
import { CoworkStore } from './coworkStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let db: BetterSqlite3.Database;
let store: CoworkStore;

/** Initialise a fresh in-memory database with the minimum schema. */
function setupDb(): void {
  db = new BetterSqlite3(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      claude_session_id TEXT,
      codex_app_thread_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      pinned INTEGER NOT NULL DEFAULT 0,
      cwd TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      execution_mode TEXT NOT NULL DEFAULT 'local',
      active_skill_ids TEXT,
      runtime_snapshot_json TEXT,
      agent_id TEXT NOT NULL DEFAULT 'main',
      session_kind TEXT NOT NULL DEFAULT 'single',
      parent_session_id TEXT,
      team_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_messages (
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS cowork_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_memories (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.75,
      is_explicit INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'created',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_memory_sources (
      id TEXT PRIMARY KEY,
      memory_id TEXT NOT NULL,
      session_id TEXT,
      message_id TEXT,
      role TEXT NOT NULL DEFAULT 'system',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (memory_id) REFERENCES user_memories(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      identity TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      agent_engine TEXT NOT NULL DEFAULT 'claude_code',
      icon TEXT NOT NULL DEFAULT '',
      skill_ids TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'custom',
      preset_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '',
      lead_agent_id TEXT NOT NULL DEFAULT '',
      members TEXT NOT NULL DEFAULT '[]',
      default_workflow TEXT NOT NULL DEFAULT 'lead_sequential',
      skill_ids TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'custom',
      preset_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // CoworkStore only needs (db)
  store = new CoworkStore(db);
}

/** Insert a session row directly. */
function insertSession(
  id: string,
  options: {
    title?: string;
    createdAt?: number;
    updatedAt?: number;
  } = {},
): void {
  const createdAt = options.createdAt ?? Date.now();
  const updatedAt = options.updatedAt ?? createdAt;
  db.prepare(
    `INSERT INTO cowork_sessions (id, title, claude_session_id, codex_app_thread_id, status, pinned, cwd, system_prompt, execution_mode, active_skill_ids, agent_id, session_kind, parent_session_id, team_id, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, 'idle', 0, '/tmp', '', 'local', '[]', 'main', 'single', NULL, NULL, ?, ?)`,
  ).run(id, options.title ?? 'test', createdAt, updatedAt);
}

/** Insert a message row directly, bypassing CoworkStore.addMessage. */
function insertMessage(
  id: string,
  sessionId: string,
  type: string,
  content: string,
  metadata: string | null,
  sequence: number,
  createdAt: number = Date.now(),
): void {
  db.prepare(
    `INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, sessionId, type, content, metadata, createdAt, sequence);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  setupDb();
});

test('getSession returns all messages when one has corrupt metadata', () => {
  const sid = 'sess-1';
  insertSession(sid);

  insertMessage('msg-valid', sid, 'user', 'hello', '{"key":"value"}', 1);
  insertMessage('msg-corrupt', sid, 'tool_use', 'do something', '{broken', 2);
  insertMessage('msg-null', sid, 'assistant', 'reply', null, 3);

  const session = store.getSession(sid);
  expect(session).not.toBeNull();
  expect(session!.messages).toHaveLength(3);

  // Valid metadata preserved
  const validMsg = session!.messages.find((m) => m.id === 'msg-valid')!;
  expect(validMsg.metadata).toEqual({ key: 'value' });

  // Corrupt metadata discarded
  const corruptMsg = session!.messages.find((m) => m.id === 'msg-corrupt')!;
  expect(corruptMsg.metadata).toBeUndefined();
  expect(corruptMsg.content).toBe('do something');
  expect(corruptMsg.type).toBe('tool_use');

  // Null metadata → undefined
  const nullMsg = session!.messages.find((m) => m.id === 'msg-null')!;
  expect(nullMsg.metadata).toBeUndefined();
});

test('getSession returns all messages when ALL have corrupt metadata', () => {
  const sid = 'sess-2';
  insertSession(sid);

  insertMessage('m1', sid, 'user', 'one', '{bad1', 1);
  insertMessage('m2', sid, 'assistant', 'two', '{{bad2', 2);
  insertMessage('m3', sid, 'tool_use', 'three', 'not json at all', 3);

  const session = store.getSession(sid);
  expect(session).not.toBeNull();
  expect(session!.messages).toHaveLength(3);

  for (const msg of session!.messages) {
    expect(msg.metadata).toBeUndefined();
    expect(msg.id).toBeTruthy();
    expect(msg.content).toBeTruthy();
  }
});

test('console.warn is called exactly once for single corrupt metadata row', () => {
  const sid = 'sess-3';
  insertSession(sid);

  insertMessage('msg-ok', sid, 'user', 'hi', '{"a":1}', 1);
  insertMessage('msg-bad', sid, 'tool_use', 'oops', '{broken', 2);
  insertMessage('msg-nil', sid, 'assistant', 'reply', null, 3);

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  store.getSession(sid);

  expect(warnSpy).toHaveBeenCalledTimes(1);

  const warnMessage = warnSpy.mock.calls[0][0] as string;
  expect(warnMessage).toContain('[CoworkStore]');
  expect(warnMessage).toContain('msg-bad');
  expect(warnMessage).toContain(sid);

  warnSpy.mockRestore();
});

test('no console.warn when all metadata is valid or null', () => {
  const sid = 'sess-4';
  insertSession(sid);

  insertMessage('m1', sid, 'user', 'hi', '{"ok":true}', 1);
  insertMessage('m2', sid, 'assistant', 'reply', null, 2);

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  store.getSession(sid);

  expect(warnSpy).not.toHaveBeenCalled();

  warnSpy.mockRestore();
});

test('insertMessageBeforeId preserves message ordering by shifting sequence', () => {
  const sid = 'sess-5';
  insertSession(sid);

  insertMessage('assistant-1', sid, 'assistant', 'second', null, 1);
  insertMessage('assistant-2', sid, 'assistant', 'third', null, 2);

  const inserted = store.insertMessageBeforeId(sid, 'assistant-2', {
    type: 'user',
    content: 'between',
  });

  const session = store.getSession(sid);
  expect(session).not.toBeNull();
  expect(inserted.type).toBe('user');
  expect(session!.messages.map((message) => message.content)).toEqual([
    'second',
    'between',
    'third',
  ]);
});

test('createSession and getSession preserve session metadata', () => {
  const created = store.createSession(
    'team session',
    '/tmp/workspace',
    'system',
    'local',
    ['skill-a'],
    'agent-a',
    {
      sessionKind: CoworkSessionKind.TeamParent,
      parentSessionId: 'parent-1',
      teamId: 'team-1',
      runtimeSnapshot: {
        agentEngine: CoworkAgentEngine.ClaudeCode,
        engineLabel: 'Claude Code',
        providerKey: 'provider-a',
        providerName: 'Provider A',
        modelId: 'model-a',
        modelName: 'Model A',
        modelLabel: 'Provider A · Model A',
        configSource: 'agora_model',
        permissionMode: 'plan',
        permissionModeLabel: 'Plan',
        capturedAt: 123,
      },
    },
  );

  const loaded = store.getSession(created.id);
  expect(loaded).not.toBeNull();
  expect(loaded).toMatchObject({
    id: created.id,
    title: 'team session',
    cwd: '/tmp/workspace',
    systemPrompt: 'system',
    executionMode: 'local',
    activeSkillIds: ['skill-a'],
    agentId: 'agent-a',
    sessionKind: CoworkSessionKind.TeamParent,
    parentSessionId: 'parent-1',
    teamId: 'team-1',
    runtimeSnapshot: {
      agentEngine: CoworkAgentEngine.ClaudeCode,
      engineLabel: 'Claude Code',
      modelId: 'model-a',
      permissionMode: 'plan',
    },
  });
  expect(loaded!.messages).toEqual([]);
});

test('setConfig and getConfig preserve normalized cowork config', () => {
  store.setConfig({
    workingDirectory: '/tmp/agora-workspace',
    agentEngine: CoworkAgentEngine.Codex,
    openclawConfigSource: ExternalAgentConfigSource.LocalCli,
    claudeCodeConfigSource: ExternalAgentConfigSource.LocalCli,
    claudeCodePermissionMode: ClaudeCodePermissionMode.Plan,
    codexConfigSource: ExternalAgentConfigSource.AgoraModel,
    hermesConfigSource: ExternalAgentConfigSource.LocalCli,
    opencodeConfigSource: ExternalAgentConfigSource.LocalCli,
    opencodePermissionMode: OpenCodePermissionMode.Conservative,
    deepseekTuiConfigSource: ExternalAgentConfigSource.LocalCli,
    deepseekTuiPermissionMode: DeepSeekTuiPermissionMode.Conservative,
    memoryEnabled: false,
    memoryImplicitUpdateEnabled: false,
    memoryLlmJudgeEnabled: true,
    memoryGuardLevel: 'relaxed',
    memoryUserMemoriesMaxItems: 120,
  });

  expect(store.getConfig()).toMatchObject({
    workingDirectory: '/tmp/agora-workspace',
    agentEngine: CoworkAgentEngine.Codex,
    openclawConfigSource: ExternalAgentConfigSource.LocalCli,
    claudeCodeConfigSource: ExternalAgentConfigSource.LocalCli,
    claudeCodePermissionMode: ClaudeCodePermissionMode.Plan,
    codexConfigSource: ExternalAgentConfigSource.AgoraModel,
    hermesConfigSource: ExternalAgentConfigSource.LocalCli,
    opencodeConfigSource: ExternalAgentConfigSource.LocalCli,
    opencodePermissionMode: OpenCodePermissionMode.Conservative,
    deepseekTuiConfigSource: ExternalAgentConfigSource.LocalCli,
    deepseekTuiPermissionMode: DeepSeekTuiPermissionMode.Conservative,
    memoryEnabled: false,
    memoryImplicitUpdateEnabled: false,
    memoryLlmJudgeEnabled: true,
    memoryGuardLevel: 'relaxed',
    memoryUserMemoriesMaxItems: 60,
  });
});

test('getAppLanguage reads persisted app_config language safely', () => {
  db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)').run(
    'app_config',
    JSON.stringify({ language: 'en' }),
  );

  expect(store.getAppLanguage()).toBe('en');

  db.prepare('UPDATE kv SET value = ? WHERE key = ?').run('{broken', 'app_config');
  expect(store.getAppLanguage()).toBe('zh');
});

test('createAgent and updateAgent preserve persisted fields', () => {
  const agent = store.createAgent({
    name: 'Planner Agent',
    description: 'plans work',
    systemPrompt: 'be methodical',
    identity: 'planner',
    model: 'gpt-5',
    agentEngine: CoworkAgentEngine.Codex,
    icon: 'brain',
    skillIds: ['plan', 'research'],
  });

  expect(agent).toMatchObject({
    id: 'planner-agent',
    name: 'Planner Agent',
    description: 'plans work',
    systemPrompt: 'be methodical',
    identity: 'planner',
    model: 'gpt-5',
    agentEngine: CoworkAgentEngine.Codex,
    icon: 'brain',
    skillIds: ['plan', 'research'],
    enabled: true,
    isDefault: false,
    source: 'custom',
  });

  const updated = store.updateAgent(agent.id, {
    model: 'gpt-5.1',
    skillIds: ['plan'],
    enabled: false,
  });

  expect(updated).toMatchObject({
    id: agent.id,
    model: 'gpt-5.1',
    skillIds: ['plan'],
    enabled: false,
  });
});

test('createAgentTeam normalizes member order and workflow fallback', () => {
  const team = store.createAgentTeam({
    name: 'Delivery Team',
    members: [
      { agentId: 'agent-b', role: 'reviewer', order: 5 },
      { agentId: 'agent-a', role: 'lead', order: 1 },
      { agentId: '', role: 'invalid', order: 0 },
    ],
    defaultWorkflow: 'unexpected' as any,
    skillIds: ['ship'],
  });

  expect(team).toMatchObject({
    id: 'delivery-team',
    leadAgentId: 'agent-a',
    defaultWorkflow: AgentTeamWorkflow.LeadSequential,
    skillIds: ['ship'],
    enabled: true,
  });
  expect(team.members).toEqual([
    { agentId: 'agent-a', role: 'lead', order: 0 },
    { agentId: 'agent-b', role: 'reviewer', order: 1 },
  ]);

  const updated = store.updateAgentTeam(team.id, {
    members: [
      { agentId: 'agent-c', role: 'executor', order: 9 },
      { agentId: 'agent-a', role: 'lead', order: 2 },
    ],
    enabled: false,
  });

  expect(updated).toMatchObject({
    id: team.id,
    enabled: false,
  });
  expect(updated!.members).toEqual([
    { agentId: 'agent-a', role: 'lead', order: 0 },
    { agentId: 'agent-c', role: 'executor', order: 1 },
  ]);
});

test('createUserMemory deduplicates repeated entries and updates stats', () => {
  const first = store.createUserMemory({
    text: ' 我喜欢 TypeScript ',
    isExplicit: false,
    source: { sessionId: 'sess-memory', role: 'user' },
  });
  const second = store.createUserMemory({
    text: '我喜欢 TypeScript',
    isExplicit: true,
    source: { sessionId: 'sess-memory', role: 'assistant' },
  });

  expect(second.id).toBe(first.id);

  const updated = store.updateUserMemory({
    id: first.id,
    text: '我偏好 TypeScript',
    status: 'stale',
    isExplicit: true,
  });

  expect(updated).toMatchObject({
    id: first.id,
    text: '我偏好 TypeScript',
    status: 'stale',
    isExplicit: true,
  });
  expect(store.listUserMemories({ status: 'all', includeDeleted: true })).toHaveLength(1);
  expect(store.getUserMemoryStats()).toMatchObject({
    total: 1,
    created: 0,
    stale: 1,
    deleted: 0,
    explicit: 1,
    implicit: 0,
  });
});

test('deleteSession marks implicit session memories stale via source cleanup', () => {
  const session = store.createSession('memory session', '/tmp/memory');
  const memory = store.createUserMemory({
    text: '我习惯使用 TypeScript',
    isExplicit: false,
    source: { sessionId: session.id, role: 'user' },
  });

  expect(store.listUserMemories({ status: 'all', includeDeleted: true })).toMatchObject([
    { id: memory.id, status: 'created', isExplicit: false },
  ]);

  store.deleteSession(session.id);

  expect(store.listUserMemories({ status: 'all', includeDeleted: true })).toMatchObject([
    { id: memory.id, status: 'stale', isExplicit: false },
  ]);
});

test('applyTurnMemoryUpdates handles explicit add and delete commands', async () => {
  const session = store.createSession('turn memory', '/tmp/turn-memory');

  const added = await store.applyTurnMemoryUpdates({
    sessionId: session.id,
    userText: '请记住：我偏好 TypeScript',
    assistantText: '好的，我会记住。',
    implicitEnabled: true,
    memoryLlmJudgeEnabled: false,
    guardLevel: 'relaxed',
    userMessageId: 'user-1',
    assistantMessageId: 'assistant-1',
  });

  expect(added).toMatchObject({
    totalChanges: 1,
    created: 1,
    updated: 0,
    deleted: 0,
  });
  expect(store.listUserMemories()).toMatchObject([
    { text: '我偏好 TypeScript', isExplicit: true, status: 'created' },
  ]);

  const removed = await store.applyTurnMemoryUpdates({
    sessionId: session.id,
    userText: '删除记忆：TypeScript',
    assistantText: '好的，已删除。',
    implicitEnabled: true,
    memoryLlmJudgeEnabled: false,
    guardLevel: 'relaxed',
  });

  expect(removed).toMatchObject({
    totalChanges: 1,
    created: 0,
    updated: 0,
    deleted: 1,
  });
  expect(store.listUserMemories({ status: 'all', includeDeleted: true })).toMatchObject([
    { text: '我偏好 TypeScript', status: 'deleted' },
  ]);
});

test('conversationSearch groups matching sessions and falls back to latest opposite-role snippets', () => {
  insertSession('sess-search-a', {
    title: 'Search A',
    createdAt: 1_000,
    updatedAt: 4_000,
  });
  insertSession('sess-search-b', {
    title: 'Search B',
    createdAt: 2_000,
    updatedAt: 3_000,
  });

  insertMessage('a-user-latest', 'sess-search-a', 'user', 'Need TypeScript help now', null, 1, 1_100);
  insertMessage('a-assistant', 'sess-search-a', 'assistant', 'I can help with that.', null, 2, 1_200);
  insertMessage('b-user', 'sess-search-b', 'user', 'TypeScript config question', null, 1, 2_100);
  insertMessage('b-assistant-old', 'sess-search-b', 'assistant', 'Older answer for B', null, 2, 2_000);
  insertMessage('b-assistant-match', 'sess-search-b', 'assistant', 'TypeScript compile fix', null, 3, 2_200);

  const records = store.conversationSearch({
    query: 'TypeScript help',
    maxResults: 2,
  });

  expect(records).toEqual([
    {
      sessionId: 'sess-search-a',
      title: 'Search A',
      updatedAt: 4_000,
      url: 'https://claude.ai/chat/sess-search-a',
      human: 'Need TypeScript help now',
      assistant: 'I can help with that.',
    },
    {
      sessionId: 'sess-search-b',
      title: 'Search B',
      updatedAt: 3_000,
      url: 'https://claude.ai/chat/sess-search-b',
      human: 'TypeScript config question',
      assistant: 'TypeScript compile fix',
    },
  ]);
});

test('recentChats respects updated_at filters and returns latest user and assistant snippets', () => {
  insertSession('sess-recent-old', {
    title: 'Old Chat',
    createdAt: 1_000,
    updatedAt: 5_000,
  });
  insertSession('sess-recent-mid', {
    title: 'Mid Chat',
    createdAt: 2_000,
    updatedAt: 10_000,
  });
  insertSession('sess-recent-new', {
    title: 'New Chat',
    createdAt: 3_000,
    updatedAt: 15_000,
  });

  insertMessage('old-user', 'sess-recent-old', 'user', 'old user', null, 1, 1_100);
  insertMessage('old-assistant', 'sess-recent-old', 'assistant', 'old assistant', null, 2, 1_200);
  insertMessage('mid-user', 'sess-recent-mid', 'user', 'mid user latest', null, 1, 2_100);
  insertMessage('mid-assistant', 'sess-recent-mid', 'assistant', 'mid assistant latest', null, 2, 2_200);
  insertMessage('new-user', 'sess-recent-new', 'user', 'new user latest', null, 1, 3_100);
  insertMessage('new-assistant', 'sess-recent-new', 'assistant', 'new assistant latest', null, 2, 3_200);

  const records = store.recentChats({
    n: 5,
    before: new Date(12_000).toISOString(),
    after: new Date(4_000).toISOString(),
  });

  expect(records).toEqual([
    {
      sessionId: 'sess-recent-mid',
      title: 'Mid Chat',
      updatedAt: 10_000,
      url: 'https://claude.ai/chat/sess-recent-mid',
      human: 'mid user latest',
      assistant: 'mid assistant latest',
    },
    {
      sessionId: 'sess-recent-old',
      title: 'Old Chat',
      updatedAt: 5_000,
      url: 'https://claude.ai/chat/sess-recent-old',
      human: 'old user',
      assistant: 'old assistant',
    },
  ]);
});
