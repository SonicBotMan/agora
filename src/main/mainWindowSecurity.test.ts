import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mainWindowSecurityTestState = vi.hoisted(() => {
  const onHeadersReceived = vi.fn();
  const openExternal = vi.fn();

  return {
    onHeadersReceived,
    openExternal,
  };
});

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: mainWindowSecurityTestState.onHeadersReceived,
      },
    },
  },
  shell: {
    openExternal: mainWindowSecurityTestState.openExternal,
  },
}));

import {
  applyWecomAuthWindowPolicies,
  configureContentSecurityPolicy,
} from './mainWindowSecurity';

function createWindow() {
  const childListeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const windowListeners = new Map<string, Array<(...args: unknown[]) => void>>();
  let windowOpenHandler:
    | ((details: { url: string }) => unknown)
    | null = null;
  const childWindow = {
    webContents: {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const current = childListeners.get(event) ?? [];
        current.push(listener);
        childListeners.set(event, current);
      }),
      emit(event: string, ...args: unknown[]) {
        for (const listener of childListeners.get(event) ?? []) {
          listener(...args);
        }
      },
    },
  };
  const window = {
    webContents: {
      setWindowOpenHandler: vi.fn((handler: (details: { url: string }) => unknown) => {
        windowOpenHandler = handler;
      }),
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const current = windowListeners.get(event) ?? [];
        current.push(listener);
        windowListeners.set(event, current);
      }),
      emit(event: string, ...args: unknown[]) {
        for (const listener of windowListeners.get(event) ?? []) {
          listener(...args);
        }
      },
    },
  };

  return {
    window,
    childWindow,
    getWindowOpenHandler: () => windowOpenHandler,
  };
}

describe('mainWindowSecurity', () => {
  const originalStartUrl = process.env.ELECTRON_START_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ELECTRON_START_URL;
  });

  afterEach(() => {
    if (originalStartUrl === undefined) {
      delete process.env.ELECTRON_START_URL;
      return;
    }
    process.env.ELECTRON_START_URL = originalStartUrl;
  });

  it('configures CSP headers and skips WeCom auth pages', () => {
    configureContentSecurityPolicy(false);
    const handler =
      mainWindowSecurityTestState.onHeadersReceived.mock.calls[0]?.[0] as
        | ((
          details: { url: string; responseHeaders: Record<string, unknown> },
          callback: (result: { responseHeaders: Record<string, unknown> }) => void,
        ) => void)
        | undefined;
    const callback = vi.fn();

    handler?.(
      {
        url: 'https://agora.ai/app',
        responseHeaders: {
          'X-Test': ['ok'],
        },
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      responseHeaders: expect.objectContaining({
        'X-Test': ['ok'],
        'Content-Security-Policy': expect.stringContaining("script-src 'self'"),
      }),
    });

    const wecomCallback = vi.fn();
    handler?.(
      {
        url: 'https://work.weixin.qq.com/oauth',
        responseHeaders: {
          'X-Test': ['ok'],
        },
      },
      wecomCallback,
    );

    expect(wecomCallback).toHaveBeenCalledWith({
      responseHeaders: {
        'X-Test': ['ok'],
      },
    });
  });

  it('uses the dev-server port in CSP script-src when running in development', () => {
    process.env.ELECTRON_START_URL = 'http://localhost:3001';
    configureContentSecurityPolicy(true);
    const handler =
      mainWindowSecurityTestState.onHeadersReceived.mock.calls[0]?.[0] as
        | ((
          details: { url: string; responseHeaders: Record<string, unknown> },
          callback: (result: { responseHeaders: Record<string, unknown> }) => void,
        ) => void)
        | undefined;
    const callback = vi.fn();

    handler?.(
      {
        url: 'https://agora.ai/app',
        responseHeaders: {},
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      responseHeaders: expect.objectContaining({
        'Content-Security-Policy': expect.stringContaining(
          "http://localhost:3001 ws://localhost:3001",
        ),
      }),
    });
  });

  it('allows WeCom auth popups, denies other popups, and blocks child navigation away from WeCom hosts', () => {
    const { window, childWindow, getWindowOpenHandler } = createWindow();
    applyWecomAuthWindowPolicies(window as never);

    const openHandler = getWindowOpenHandler();
    expect(openHandler?.({ url: 'https://open.work.weixin.qq.com/auth' })).toEqual(
      {
        action: 'allow',
        overrideBrowserWindowOptions: expect.objectContaining({
          width: 950,
          height: 640,
          title: '企业微信授权',
        }),
      },
    );

    expect(openHandler?.({ url: 'https://example.com' })).toEqual({
      action: 'deny',
    });
    expect(mainWindowSecurityTestState.openExternal).toHaveBeenCalledWith(
      'https://example.com',
    );

    window.webContents.emit('did-create-window', childWindow);

    const blockedEvent = {
      preventDefault: vi.fn(),
    };
    childWindow.webContents.emit(
      'will-navigate',
      blockedEvent,
      'https://example.com/path',
    );
    expect(blockedEvent.preventDefault).toHaveBeenCalledTimes(1);

    const allowedEvent = {
      preventDefault: vi.fn(),
    };
    childWindow.webContents.emit(
      'will-navigate',
      allowedEvent,
      'https://wwcdn.weixin.qq.com/login',
    );
    expect(allowedEvent.preventDefault).not.toHaveBeenCalled();
  });
});
