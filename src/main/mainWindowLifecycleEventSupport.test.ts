import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  registerMainWindowEventLifecycle,
  registerMainWindowLoadLifecycle,
} from './mainWindowLifecycleEventSupport';

type EventListener = (...args: unknown[]) => void;

function createEmitter() {
  const listeners = new Map<string, Array<{ listener: EventListener; once: boolean }>>();

  return {
    on(event: string, listener: EventListener) {
      const current = listeners.get(event) ?? [];
      current.push({ listener, once: false });
      listeners.set(event, current);
      return this;
    },
    once(event: string, listener: EventListener) {
      const current = listeners.get(event) ?? [];
      current.push({ listener, once: true });
      listeners.set(event, current);
      return this;
    },
    emit(event: string, ...args: unknown[]) {
      const current = [...(listeners.get(event) ?? [])];
      for (const entry of current) {
        entry.listener(...args);
      }
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((entry) => !entry.once),
      );
    },
  };
}

function createWindow(options: {
  loadURL?: ReturnType<typeof vi.fn>;
  isDestroyed?: boolean;
  isLoadingMainFrame?: boolean;
} = {}) {
  const webContentsEmitter = createEmitter();
  const windowEmitter = createEmitter();
  const state = {
    destroyed: options.isDestroyed ?? false,
    loadingMainFrame: options.isLoadingMainFrame ?? false,
  };
  const webContents = {
    on: webContentsEmitter.on.bind(webContentsEmitter),
    once: webContentsEmitter.once.bind(webContentsEmitter),
    emit: webContentsEmitter.emit.bind(webContentsEmitter),
    isLoadingMainFrame: vi.fn(() => state.loadingMainFrame),
    openDevTools: vi.fn(),
    send: vi.fn(),
  };
  const window = {
    on: windowEmitter.on.bind(windowEmitter),
    emit: windowEmitter.emit.bind(windowEmitter),
    webContents,
    isDestroyed: vi.fn(() => state.destroyed),
    loadURL: options.loadURL ?? vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    setMinimumSize: vi.fn(),
    hide: vi.fn(),
  };

  return {
    window,
    webContents,
    state,
  };
}

describe('mainWindowLifecycleEventSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the production page and forwards window state plus engine statuses after finish-load', () => {
    const { window, webContents } = createWindow();
    const deps = {
      isDev: false,
      devServerUrl: 'http://127.0.0.1:5175',
      errorPagePath: '/tmp/error.html',
      prodIndexPath: '/tmp/index.html',
      emitWindowState: vi.fn(),
      scheduleReload: vi.fn(),
      openClawEngineManager: {
        getStatus: vi.fn().mockReturnValue({ phase: 'running' }),
      },
      hermesEngineManager: {
        getStatus: vi.fn().mockReturnValue({ phase: 'ready' }),
      },
    };

    registerMainWindowLoadLifecycle(window as never, deps as never);
    webContents.emit('did-finish-load');

    expect(window.loadFile).toHaveBeenCalledWith('/tmp/index.html');
    expect(deps.emitWindowState).toHaveBeenCalledTimes(1);
    expect(webContents.send).toHaveBeenCalledWith(
      'openclaw:engine:onProgress',
      { phase: 'running' },
    );
    expect(webContents.send).toHaveBeenCalledWith(
      'hermes:engine:onProgress',
      { phase: 'ready' },
    );
  });

  it('reloads on load timeout, render-process crash, and did-fail-load in development', async () => {
    vi.useFakeTimers();
    const { window, webContents, state } = createWindow({
      isLoadingMainFrame: true,
    });
    const deps = {
      isDev: true,
      devServerUrl: 'http://127.0.0.1:5175',
      errorPagePath: '/tmp/error.html',
      prodIndexPath: '/tmp/index.html',
      emitWindowState: vi.fn(),
      scheduleReload: vi.fn(),
      openClawEngineManager: null,
      hermesEngineManager: null,
    };

    registerMainWindowLoadLifecycle(window as never, deps as never);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(deps.scheduleReload).toHaveBeenCalledWith('load-timeout');

    webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    expect(deps.scheduleReload).toHaveBeenCalledWith('webContents-crashed');

    webContents.emit('did-fail-load', {}, -7, 'connection failed');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(deps.scheduleReload).toHaveBeenCalledWith('did-fail-load');

    state.loadingMainFrame = false;
  });

  it('retries dev-server loading and falls back to the error page after exhausting retries', async () => {
    vi.useFakeTimers();
    const loadURL = vi.fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValueOnce(new Error('third'));
    const { window, webContents } = createWindow({
      loadURL,
    });
    const deps = {
      isDev: true,
      devServerUrl: 'http://127.0.0.1:5175',
      errorPagePath: '/tmp/error.html',
      prodIndexPath: '/tmp/index.html',
      emitWindowState: vi.fn(),
      scheduleReload: vi.fn(),
      openClawEngineManager: null,
      hermesEngineManager: null,
    };

    registerMainWindowLoadLifecycle(window as never, deps as never);
    expect(webContents.openDevTools).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(3_000);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(3_000);
    await Promise.resolve();

    expect(window.loadURL).toHaveBeenCalledTimes(3);
    expect(window.loadFile).toHaveBeenCalledWith('/tmp/error.html');
  });

  it('hides the window on close outside dev mode and forwards lifecycle events', () => {
    const { window } = createWindow();
    const deps = {
      isDev: false,
      isQuitting: vi.fn().mockReturnValue(false),
      emitWindowState: vi.fn(),
      onWindowClosed: vi.fn(),
    };
    const closeEvent = {
      preventDefault: vi.fn(),
    };

    registerMainWindowEventLifecycle(window as never, deps as never);

    expect(window.setMinimumSize).toHaveBeenCalledWith(800, 600);

    window.emit('close', closeEvent);
    expect(closeEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(window.hide).toHaveBeenCalledTimes(1);

    window.emit('closed');
    expect(deps.onWindowClosed).toHaveBeenCalledTimes(1);

    window.emit('maximize');
    window.emit('unmaximize');
    window.emit('enter-full-screen');
    window.emit('leave-full-screen');
    window.emit('focus');
    window.emit('blur');
    expect(deps.emitWindowState).toHaveBeenCalledTimes(6);
  });

  it('allows the close event to proceed when quitting or running in development', () => {
    const quitting = createWindow();
    const dev = createWindow();
    const quittingEvent = {
      preventDefault: vi.fn(),
    };
    const devEvent = {
      preventDefault: vi.fn(),
    };

    registerMainWindowEventLifecycle(
      quitting.window as never,
      {
        isDev: false,
        isQuitting: vi.fn().mockReturnValue(true),
        emitWindowState: vi.fn(),
        onWindowClosed: vi.fn(),
      } as never,
    );
    registerMainWindowEventLifecycle(
      dev.window as never,
      {
        isDev: true,
        isQuitting: vi.fn().mockReturnValue(false),
        emitWindowState: vi.fn(),
        onWindowClosed: vi.fn(),
      } as never,
    );

    quitting.window.emit('close', quittingEvent);
    dev.window.emit('close', devEvent);

    expect(quittingEvent.preventDefault).not.toHaveBeenCalled();
    expect(quitting.window.hide).not.toHaveBeenCalled();
    expect(devEvent.preventDefault).not.toHaveBeenCalled();
    expect(dev.window.hide).not.toHaveBeenCalled();
  });
});
