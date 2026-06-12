import { describe, expect, it, vi } from 'vitest';

import {
  bindAskUserHandlers,
  broadcastMcpBridgeSync,
  createMcpBridgeConfig,
} from './mcpBridgeRuntimeSupport';

describe('mcpBridgeRuntimeSupport', () => {
  it('creates a bridge config only when callback URLs and secret are available', () => {
    expect(
      createMcpBridgeConfig({
        bridgeServer: null,
        bridgeSecret: 'secret',
        toolManifest: [],
      }),
    ).toBeNull();

    expect(
      createMcpBridgeConfig({
        bridgeServer: {
          callbackUrl: 'http://127.0.0.1:8923/mcp/execute',
          askUserCallbackUrl: 'http://127.0.0.1:8923/askuser',
        } as never,
        bridgeSecret: 'secret',
        toolManifest: [{ server: 'alpha', name: 'tool' }] as never,
      }),
    ).toEqual({
      callbackUrl: 'http://127.0.0.1:8923/mcp/execute',
      askUserCallbackUrl: 'http://127.0.0.1:8923/askuser',
      secret: 'secret',
      tools: [{ server: 'alpha', name: 'tool' }],
    });
  });

  it('broadcasts sync events to active windows and skips destroyed ones', () => {
    const send = vi.fn();
    const activeWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send },
    };
    const destroyedWindow = {
      isDestroyed: vi.fn().mockReturnValue(true),
      webContents: { send: vi.fn() },
    };

    broadcastMcpBridgeSync(
      [activeWindow as never, destroyedWindow as never],
      'mcp:bridge:syncDone',
      { tools: 2 },
    );

    expect(send).toHaveBeenCalledWith('mcp:bridge:syncDone', { tools: 2 });
    expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();
  });

  it('binds ask-user handlers that forward permission events to active windows', () => {
    let askUserHandler:
      | ((request: { requestId: string; questions: unknown[] }) => void)
      | undefined;
    let dismissHandler: ((requestId: string) => void) | undefined;
    const server = {
      onAskUser: vi.fn((handler) => {
        askUserHandler = handler;
      }),
      onAskUserDismiss: vi.fn((handler) => {
        dismissHandler = handler;
      }),
    };
    const send = vi.fn();
    const window = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send },
    };

    bindAskUserHandlers(server as never, () => [window as never]);

    askUserHandler?.({
      requestId: 'req-1',
      questions: [{ question: 'Continue?' }],
    });
    expect(send).toHaveBeenCalledWith('cowork:stream:permission', {
      sessionId: '__askuser__',
      request: {
        requestId: 'req-1',
        toolName: 'AskUserQuestion',
        toolInput: { questions: [{ question: 'Continue?' }] },
      },
    });

    dismissHandler?.('req-1');
    expect(send).toHaveBeenCalledWith('cowork:stream:permissionDismiss', {
      requestId: 'req-1',
    });
  });
});
