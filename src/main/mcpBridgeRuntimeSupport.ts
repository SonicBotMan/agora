import type { BrowserWindow } from 'electron';

import type { AskUserRequest, McpBridgeServer } from './libs/mcpBridgeServer';
import type { McpBridgeConfig } from './libs/openclawConfigSync';

export function createMcpBridgeConfig(deps: {
  bridgeServer: Pick<McpBridgeServer, 'callbackUrl' | 'askUserCallbackUrl'> | null;
  bridgeSecret: string | null;
  toolManifest: McpBridgeConfig['tools'];
}): McpBridgeConfig | null {
  if (
    !deps.bridgeServer?.callbackUrl
    || !deps.bridgeServer.askUserCallbackUrl
    || !deps.bridgeSecret
  ) {
    return null;
  }

  return {
    callbackUrl: deps.bridgeServer.callbackUrl,
    askUserCallbackUrl: deps.bridgeServer.askUserCallbackUrl,
    secret: deps.bridgeSecret,
    tools: deps.toolManifest,
  };
}

export function broadcastMcpBridgeSync(
  windows: BrowserWindow[],
  channel: string,
  data?: Record<string, unknown>,
): void {
  windows.forEach((win) => {
    if (win.isDestroyed()) return;
    try {
      win.webContents.send(channel, data ?? {});
    } catch (error) {
      console.error(`[McpBridge] Failed to broadcast ${channel}:`, error);
    }
  });
}

export function bindAskUserHandlers(
  server: Pick<McpBridgeServer, 'onAskUser' | 'onAskUserDismiss'>,
  getWindows: () => BrowserWindow[],
): void {
  server.onAskUser((request: AskUserRequest) => {
    getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send('cowork:stream:permission', {
          sessionId: '__askuser__',
          request: {
            requestId: request.requestId,
            toolName: 'AskUserQuestion',
            toolInput: { questions: request.questions },
          },
        });
      } catch (error) {
        console.error(
          '[AskUser] failed to send permission request to window:',
          error,
        );
      }
    });
  });

  server.onAskUserDismiss((requestId: string) => {
    getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send('cowork:stream:permissionDismiss', {
          requestId,
        });
      } catch {
        // ignore
      }
    });
  });
}
