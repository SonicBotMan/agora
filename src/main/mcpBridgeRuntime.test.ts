import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const enabledServers = [
  { id: 'srv-1', name: 'alpha' },
];
const toolManifest = [
  {
    server: 'alpha',
    name: 'tool-a',
    description: 'Tool A',
    inputSchema: {},
  },
];

const mcpStoreInstances: Array<{
  getEnabledServers: ReturnType<typeof vi.fn>;
}> = [];
const mcpServerManagerInstances: Array<{
  toolManifest: typeof toolManifest;
  startServers: ReturnType<typeof vi.fn>;
  stopServers: ReturnType<typeof vi.fn>;
}> = [];
const mcpBridgeServerInstances: Array<{
  port: number | null;
  callbackUrl: string | null;
  askUserCallbackUrl: string | null;
  onAskUser: ReturnType<typeof vi.fn>;
  onAskUserDismiss: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('secret-123'),
}));

vi.mock('./mcpStore', () => ({
  McpStore: class {
    getEnabledServers = vi.fn().mockReturnValue(enabledServers);

    constructor() {
      mcpStoreInstances.push(this);
    }
  },
}));

vi.mock('./libs/mcpServerManager', () => ({
  McpServerManager: class {
    toolManifest = toolManifest;
    startServers = vi.fn().mockResolvedValue(toolManifest);
    stopServers = vi.fn().mockResolvedValue(undefined);

    constructor() {
      mcpServerManagerInstances.push(this);
    }
  },
}));

vi.mock('./libs/mcpBridgeServer', () => ({
  McpBridgeServer: class {
    port: number | null = null;
    callbackUrl: string | null = null;
    askUserCallbackUrl: string | null = null;
    onAskUser = vi.fn();
    onAskUserDismiss = vi.fn();
    start = vi.fn().mockImplementation(async () => {
      this.port = 8923;
      this.callbackUrl = 'http://127.0.0.1:8923/mcp/execute';
      this.askUserCallbackUrl = 'http://127.0.0.1:8923/askuser';
    });
    stop = vi.fn().mockResolvedValue(undefined);

    constructor() {
      mcpBridgeServerInstances.push(this);
    }
  },
}));

import { createMcpBridgeRuntime } from './mcpBridgeRuntime';

describe('mcpBridgeRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mcpStoreInstances.length = 0;
    mcpServerManagerInstances.length = 0;
    mcpBridgeServerInstances.length = 0;
  });

  it('caches the MCP store and orchestrates bridge startup and shutdown', async () => {
    const sqliteStore = {
      getDatabase: vi.fn().mockReturnValue({ id: 'db' }),
    };
    const runtime = createMcpBridgeRuntime({
      getStore: vi.fn().mockReturnValue(sqliteStore),
      getWindows: vi.fn().mockReturnValue([]),
      syncOpenClawConfig: vi.fn(),
    });

    expect(runtime.getMcpStore()).toBe(runtime.getMcpStore());
    expect(sqliteStore.getDatabase).toHaveBeenCalledTimes(1);

    const config = await runtime.startBridge();

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(mcpStoreInstances[0]?.getEnabledServers).toHaveBeenCalledTimes(1);
    expect(mcpServerManagerInstances[0]?.startServers).toHaveBeenCalledWith(
      enabledServers,
    );
    expect(mcpBridgeServerInstances[0]?.start).toHaveBeenCalledTimes(1);
    expect(config).toEqual({
      callbackUrl: 'http://127.0.0.1:8923/mcp/execute',
      askUserCallbackUrl: 'http://127.0.0.1:8923/askuser',
      secret: 'secret-123',
      tools: toolManifest,
    });
    expect(runtime.getBridgeConfig()).toEqual({
      callbackUrl: 'http://127.0.0.1:8923/mcp/execute',
      askUserCallbackUrl: 'http://127.0.0.1:8923/askuser',
      secret: 'secret-123',
      tools: toolManifest,
    });

    await runtime.stopBridge();

    expect(mcpServerManagerInstances[0]?.stopServers).toHaveBeenCalledTimes(1);
    expect(mcpBridgeServerInstances[0]?.stop).toHaveBeenCalledTimes(1);
    expect(runtime.getBridgeConfig()).toBeNull();
  });

  it('refreshes the bridge, broadcasts sync progress, and returns config sync failures', async () => {
    const send = vi.fn();
    const runtime = createMcpBridgeRuntime({
      getStore: vi.fn().mockReturnValue({
        getDatabase: vi.fn().mockReturnValue({ id: 'db' }),
      }),
      getWindows: vi.fn().mockReturnValue([
        {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send },
        },
      ]),
      syncOpenClawConfig: vi.fn().mockResolvedValue({
        success: false,
        changed: false,
        error: 'sync failed',
      }),
    });

    await runtime.startBridge();
    const result = await runtime.refreshBridge();

    expect(mcpServerManagerInstances[0]?.stopServers).toHaveBeenCalledTimes(1);
    expect(mcpServerManagerInstances[0]?.startServers).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ tools: 1, error: 'sync failed' });
    expect(send).toHaveBeenCalledWith('mcp:bridge:syncStart', {});
    expect(send).toHaveBeenCalledWith('mcp:bridge:syncDone', {
      tools: 1,
      error: 'sync failed',
    });
  });
});
