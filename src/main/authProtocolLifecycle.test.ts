import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { createServer } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => ({
    toString: vi.fn().mockReturnValue('fixed-auth-token'),
  })),
}));

type MockRequest = {
  url?: string;
};

type MockResponse = {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

type MockServerInstance = EventEmitter & {
  listening: boolean;
  listen: ReturnType<typeof vi.fn>;
  address: ReturnType<typeof vi.fn>;
  handler: (request: MockRequest, response: MockResponse) => void;
};

const httpServerInstances: MockServerInstance[] = [];

vi.mock('http', () => ({
  createServer: vi.fn(
    (handler: (request: MockRequest, response: MockResponse) => void) => {
      const server = Object.assign(new EventEmitter(), {
        listening: false,
        listen: vi.fn(
          (
            _port: number,
            _host: string,
            callback?: () => void,
          ) => {
            server.listening = true;
            callback?.();
            return server;
          },
        ),
        address: vi.fn(() => ({ port: 43123 })),
        handler,
      }) as MockServerInstance;
      httpServerInstances.push(server);
      return server;
    },
  ),
}));

import { registerAuthProtocolLifecycle } from './authProtocolLifecycle';

const createResponse = (): MockResponse => ({
  writeHead: vi.fn(),
  end: vi.fn(),
});

const createMainWindow = (overrides: Record<string, unknown> = {}) => ({
  isDestroyed: vi.fn().mockReturnValue(false),
  isMinimized: vi.fn().mockReturnValue(false),
  isVisible: vi.fn().mockReturnValue(true),
  isFocused: vi.fn().mockReturnValue(true),
  restore: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  webContents: {
    send: vi.fn(),
  },
  ...overrides,
});

const createApp = () =>
  Object.assign(new EventEmitter(), {
    getAppPath: vi.fn().mockReturnValue('/Applications/Agora.app'),
    setAsDefaultProtocolClient: vi.fn().mockReturnValue(true),
  });

describe('authProtocolLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    httpServerInstances.length = 0;
  });

  it('creates and caches the desktop OAuth callback URL', async () => {
    const app = createApp();
    const runtime = registerAuthProtocolLifecycle({
      app: app as never,
      getMainWindow: () => null,
    });

    const first = await runtime.ensureDesktopAuthCallbackUrl();
    const second = await runtime.ensureDesktopAuthCallbackUrl();

    expect(randomBytes).toHaveBeenCalledWith(18);
    expect(createServer).toHaveBeenCalledTimes(1);
    expect(httpServerInstances[0]?.listen).toHaveBeenCalledTimes(1);
    expect(first).toBe(
      'http://127.0.0.1:43123/auth/callback?token=fixed-auth-token',
    );
    expect(second).toBe(first);
  });

  it('handles local OAuth callback requests and forwards the auth code', async () => {
    const mainWindow = createMainWindow();
    const runtime = registerAuthProtocolLifecycle({
      app: createApp() as never,
      getMainWindow: () => mainWindow as never,
    });

    await runtime.ensureDesktopAuthCallbackUrl();

    const successResponse = createResponse();
    httpServerInstances[0]?.handler(
      {
        url: '/auth/callback?token=fixed-auth-token&code=auth-code-123',
      },
      successResponse,
    );

    expect(runtime.getPendingAuthCode()).toBe('auth-code-123');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('auth:callback', {
      code: 'auth-code-123',
    });
    expect(successResponse.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    expect(successResponse.end).toHaveBeenCalledWith(
      expect.stringContaining('Agora 登录完成'),
    );

    const missingCodeResponse = createResponse();
    httpServerInstances[0]?.handler(
      {
        url: '/auth/callback?token=fixed-auth-token',
      },
      missingCodeResponse,
    );
    expect(missingCodeResponse.writeHead).toHaveBeenCalledWith(400, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
    expect(missingCodeResponse.end).toHaveBeenCalledWith('Missing auth code');

    const invalidTokenResponse = createResponse();
    httpServerInstances[0]?.handler(
      {
        url: '/auth/callback?token=wrong-token&code=ignored',
      },
      invalidTokenResponse,
    );
    expect(invalidTokenResponse.writeHead).toHaveBeenCalledWith(404, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
    expect(invalidTokenResponse.end).toHaveBeenCalledWith('Not found');
  });

  it('consumes open-url deep links and forwards the auth callback to the renderer', () => {
    const mainWindow = createMainWindow();
    const app = createApp();
    const runtime = registerAuthProtocolLifecycle({
      app: app as never,
      getMainWindow: () => mainWindow as never,
    });
    const event = {
      preventDefault: vi.fn(),
    };

    runtime.setPendingAuthCode(null);
    app.emit('open-url', event, 'agora://auth/callback?code=deep-link-code');

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(runtime.getPendingAuthCode()).toBe('deep-link-code');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('auth:callback', {
      code: 'deep-link-code',
    });
  });

  it('handles second-instance deep links and restores the main window', () => {
    const mainWindow = createMainWindow({
      isMinimized: vi.fn().mockReturnValue(true),
      isVisible: vi.fn().mockReturnValue(false),
      isFocused: vi.fn().mockReturnValue(false),
    });
    const app = createApp();
    const runtime = registerAuthProtocolLifecycle({
      app: app as never,
      getMainWindow: () => mainWindow as never,
    });

    app.emit(
      'second-instance',
      {},
      ['--flag', 'agora://auth/callback?code=second-instance-code'],
      '/workspace',
    );

    expect(runtime.getPendingAuthCode()).toBe('second-instance-code');
    expect(mainWindow.restore).toHaveBeenCalledTimes(1);
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
  });
});
