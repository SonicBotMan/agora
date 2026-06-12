import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { McpStore } from './mcpStore';

describe('mcpStore', () => {
  let db: Database.Database;
  let store: McpStore;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        transport_type TEXT NOT NULL DEFAULT 'stdio',
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    store = new McpStore(db);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it('creates and lists MCP servers with serialized config fields', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000);

    const alpha = store.createServer({
      name: 'alpha',
      description: 'First server',
      transportType: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { TOKEN: 'abc' },
      isBuiltIn: true,
      githubUrl: 'https://github.com/example/alpha',
    });
    const beta = store.createServer({
      name: 'beta',
      description: 'Second server',
      transportType: 'http',
      url: 'https://mcp.example.com',
      headers: { Authorization: 'Bearer token' },
      registryId: 'registry-beta',
    });

    expect(store.listServers()).toMatchObject([
      {
        id: alpha.id,
        name: 'alpha',
        description: 'First server',
        enabled: true,
        transportType: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { TOKEN: 'abc' },
        isBuiltIn: true,
        githubUrl: 'https://github.com/example/alpha',
      },
      {
        id: beta.id,
        name: 'beta',
        description: 'Second server',
        enabled: true,
        transportType: 'http',
        url: 'https://mcp.example.com',
        headers: { Authorization: 'Bearer token' },
        registryId: 'registry-beta',
      },
    ]);
  });

  it('updates MCP servers by merging partial fields and can clear empty env/headers', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const created = store.createServer({
      name: 'alpha',
      description: 'First server',
      transportType: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { TOKEN: 'abc' },
      headers: { Authorization: 'Bearer token' },
    });

    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const updated = store.updateServer(created.id, {
      description: 'Updated server',
      transportType: 'sse',
      url: 'https://mcp.example.com/sse',
      env: {},
      headers: {},
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: 'alpha',
      description: 'Updated server',
      transportType: 'sse',
      command: 'node',
      args: ['server.js'],
      url: 'https://mcp.example.com/sse',
      env: undefined,
      headers: undefined,
    });
  });

  it('enables, disables, and deletes servers while filtering enabled results', () => {
    const alpha = store.createServer({
      name: 'alpha',
      description: 'First server',
      transportType: 'stdio',
      command: 'node',
    });
    const beta = store.createServer({
      name: 'beta',
      description: 'Second server',
      transportType: 'stdio',
      command: 'node',
    });

    expect(store.setEnabled(alpha.id, false)).toBe(true);
    expect(store.getEnabledServers().map((server) => server.id)).toEqual([
      beta.id,
    ]);

    expect(store.deleteServer(alpha.id)).toBe(true);
    expect(store.deleteServer(alpha.id)).toBe(false);
    expect(store.setEnabled('missing', true)).toBe(false);
  });

  it('falls back safely when config_json is invalid JSON', () => {
    db.prepare(`
      INSERT INTO mcp_servers (
        id, name, description, enabled, transport_type, config_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'broken',
      'broken-server',
      'Broken config',
      1,
      'stdio',
      '{not-valid-json',
      1000,
      1000,
    );

    expect(store.getServer('broken')).toEqual({
      id: 'broken',
      name: 'broken-server',
      description: 'Broken config',
      enabled: true,
      transportType: 'stdio',
      command: undefined,
      args: undefined,
      env: undefined,
      url: undefined,
      headers: undefined,
      isBuiltIn: false,
      githubUrl: undefined,
      registryId: undefined,
      createdAt: 1000,
      updatedAt: 1000,
    });
  });
});
