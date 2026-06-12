import { randomUUID } from 'crypto';
import type { BrowserWindow } from 'electron';

import { McpBridgeServer } from './libs/mcpBridgeServer';
import { McpServerManager } from './libs/mcpServerManager';
import type { McpBridgeConfig } from './libs/openclawConfigSync';
import {
  bindAskUserHandlers,
  broadcastMcpBridgeSync,
  createMcpBridgeConfig,
} from './mcpBridgeRuntimeSupport';
import { McpStore } from './mcpStore';
import type { SqliteStore } from './sqliteStore';

type SyncOpenClawConfigResult = {
  success: boolean;
  changed: boolean;
  error?: string;
};

export interface McpBridgeRuntimeDeps {
  getStore: () => SqliteStore;
  getWindows: () => BrowserWindow[];
  syncOpenClawConfig: (opts: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
}

export interface McpBridgeRuntime {
  getMcpStore: () => McpStore;
  getBridgeConfig: () => McpBridgeConfig | null;
  startBridge: () => Promise<McpBridgeConfig | null>;
  stopBridge: () => Promise<void>;
  refreshBridge: () => Promise<{ tools: number; error?: string }>;
}

export function createMcpBridgeRuntime(
  deps: McpBridgeRuntimeDeps,
): McpBridgeRuntime {
  let mcpStore: McpStore | null = null;
  let mcpServerManager: McpServerManager | null = null;
  let mcpBridgeServer: McpBridgeServer | null = null;
  let mcpBridgeSecret: string | null = null;
  let mcpBridgeStartPromise: Promise<McpBridgeConfig | null> | null = null;
  let mcpBridgeRefreshPromise: Promise<{ tools: number; error?: string }>
    | null = null;

  const getMcpStore = (): McpStore => {
    if (!mcpStore) {
      const sqliteStore = deps.getStore();
      mcpStore = new McpStore(sqliteStore.getDatabase());
    }
    return mcpStore;
  };

  const getBridgeConfig = (): McpBridgeConfig | null => {
    return createMcpBridgeConfig({
      bridgeServer: mcpBridgeServer,
      bridgeSecret: mcpBridgeSecret,
      toolManifest: mcpServerManager?.toolManifest ?? [],
    });
  };

  const startBridge = (): Promise<McpBridgeConfig | null> => {
    if (mcpBridgeStartPromise) {
      return mcpBridgeStartPromise;
    }

    mcpBridgeStartPromise = (async (): Promise<McpBridgeConfig | null> => {
      try {
        console.log('[McpBridge] startMcpBridge called');

        if (!mcpBridgeSecret) {
          mcpBridgeSecret = randomUUID();
        }

        const enabledServers = getMcpStore().getEnabledServers();
        console.log(
          `[McpBridge] enabledServers: ${enabledServers.length} (${enabledServers.map((server) => server.name).join(', ')})`,
        );

        let tools: Awaited<ReturnType<McpServerManager['startServers']>> = [];
        if (enabledServers.length > 0) {
          if (!mcpServerManager) {
            mcpServerManager = new McpServerManager();
          }
          console.log('[McpBridge] starting MCP servers...');
          tools = await mcpServerManager.startServers(enabledServers);
          console.log(`[McpBridge] tools discovered: ${tools.length}`);
        }

        if (!mcpServerManager) {
          mcpServerManager = new McpServerManager();
        }
        if (!mcpBridgeServer) {
          mcpBridgeServer = new McpBridgeServer(
            mcpServerManager,
            mcpBridgeSecret,
          );
          bindAskUserHandlers(mcpBridgeServer, deps.getWindows);
        }
        if (!mcpBridgeServer.port) {
          console.log('[McpBridge] starting HTTP callback server...');
          await mcpBridgeServer.start();
        }

        const callbackUrl = mcpBridgeServer.callbackUrl;
        const askUserCallbackUrl = mcpBridgeServer.askUserCallbackUrl;
        if (!callbackUrl || !askUserCallbackUrl) {
          console.error('[McpBridge] failed to get callback URL');
          return null;
        }

        console.log(
          `[McpBridge] started: ${tools.length} MCP tools, callback=${callbackUrl}`,
        );
        return {
          callbackUrl,
          askUserCallbackUrl,
          secret: mcpBridgeSecret,
          tools,
        };
      } catch (error) {
        console.error(
          '[McpBridge] startup error:',
          error instanceof Error ? error.stack || error.message : String(error),
        );
        return null;
      }
    })().finally(() => {
      mcpBridgeStartPromise = null;
    });

    return mcpBridgeStartPromise;
  };

  const stopBridge = async (): Promise<void> => {
    try {
      if (mcpServerManager) {
        await mcpServerManager.stopServers();
      }
      if (mcpBridgeServer) {
        await mcpBridgeServer.stop();
      }
    } catch (error) {
      console.error(
        '[McpBridge] shutdown error:',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      mcpBridgeServer = null;
      mcpServerManager = null;
      mcpBridgeStartPromise = null;
      mcpBridgeRefreshPromise = null;
    }
  };

  const refreshBridge = (): Promise<{ tools: number; error?: string }> => {
    if (mcpBridgeRefreshPromise) {
      return mcpBridgeRefreshPromise;
    }

    mcpBridgeRefreshPromise = (async () => {
      try {
        console.log('[McpBridge] refreshing after config change...');
        broadcastMcpBridgeSync(deps.getWindows(), 'mcp:bridge:syncStart');

        if (mcpServerManager) {
          await mcpServerManager.stopServers();
        }

        const bridgeConfig = await startBridge();
        const toolCount = bridgeConfig?.tools.length ?? 0;
        console.log(`[McpBridge] refresh: ${toolCount} tools discovered`);

        const syncResult = await deps.syncOpenClawConfig({
          reason: 'mcp-server-changed',
        });
        if (!syncResult.success) {
          console.error(
            '[McpBridge] refresh: config sync failed:',
            syncResult.error,
          );
          return { tools: toolCount, error: syncResult.error };
        }

        console.log(
          `[McpBridge] refresh complete: ${toolCount} tools, gateway restarted=${syncResult.changed}`,
        );
        return { tools: toolCount };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error('[McpBridge] refresh error:', message);
        return { tools: 0, error: message };
      }
    })()
      .then((result) => {
        broadcastMcpBridgeSync(deps.getWindows(), 'mcp:bridge:syncDone', {
          tools: result.tools,
          error: result.error,
        });
        return result;
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : String(error);
        broadcastMcpBridgeSync(deps.getWindows(), 'mcp:bridge:syncDone', {
          tools: 0,
          error: message,
        });
        return { tools: 0, error: message };
      })
      .finally(() => {
        mcpBridgeRefreshPromise = null;
      });

    return mcpBridgeRefreshPromise;
  };

  return {
    getMcpStore,
    getBridgeConfig,
    startBridge,
    stopBridge,
    refreshBridge,
  };
}
