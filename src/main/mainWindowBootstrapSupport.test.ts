import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainWindowBootstrapSupportTestState = vi.hoisted(() => {
  const createdWindows: Array<{
    options: Record<string, unknown>;
    setMenu: ReturnType<typeof vi.fn>;
    isMinimized: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    isVisible: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    isFocused: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
  }> = [];
  const createMainWindowOptions = vi.fn();
  const resolveMainWindowBootstrapPaths = vi.fn();
  const setupMainWindowLifecycle = vi.fn();
  const setupMainWindowReadyLifecycle = vi.fn();
  const applyWecomAuthWindowPolicies = vi.fn();
  const existsSync = vi.fn();
  const createFromPath = vi.fn((imagePath: string) => ({ path: imagePath }));

  class MockBrowserWindow {
    options: Record<string, unknown>;
    setMenu: ReturnType<typeof vi.fn>;
    isMinimized: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    isVisible: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    isFocused: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.setMenu = vi.fn();
      this.isMinimized = vi.fn().mockReturnValue(false);
      this.restore = vi.fn();
      this.isVisible = vi.fn().mockReturnValue(true);
      this.show = vi.fn();
      this.isFocused = vi.fn().mockReturnValue(true);
      this.focus = vi.fn();
      createdWindows.push(this);
    }
  }

  return {
    createdWindows,
    createMainWindowOptions,
    resolveMainWindowBootstrapPaths,
    setupMainWindowLifecycle,
    setupMainWindowReadyLifecycle,
    applyWecomAuthWindowPolicies,
    existsSync,
    createFromPath,
    MockBrowserWindow,
  };
});

vi.mock('electron', () => ({
  BrowserWindow: mainWindowBootstrapSupportTestState.MockBrowserWindow,
  nativeImage: {
    createFromPath: mainWindowBootstrapSupportTestState.createFromPath,
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mainWindowBootstrapSupportTestState.existsSync,
  },
}));

vi.mock('./mainWindowBootstrapOptionSupport', () => ({
  createMainWindowOptions:
    mainWindowBootstrapSupportTestState.createMainWindowOptions,
}));

vi.mock('./mainWindowBootstrapPathSupport', () => ({
  resolveMainWindowBootstrapPaths:
    mainWindowBootstrapSupportTestState.resolveMainWindowBootstrapPaths,
}));

vi.mock('./mainWindowLifecycle', () => ({
  setupMainWindowLifecycle:
    mainWindowBootstrapSupportTestState.setupMainWindowLifecycle,
}));

vi.mock('./mainWindowReadyLifecycle', () => ({
  setupMainWindowReadyLifecycle:
    mainWindowBootstrapSupportTestState.setupMainWindowReadyLifecycle,
}));

vi.mock('./mainWindowSecurity', () => ({
  applyWecomAuthWindowPolicies:
    mainWindowBootstrapSupportTestState.applyWecomAuthWindowPolicies,
}));

import {
  createMainWindow,
  focusExistingMainWindow,
} from './mainWindowBootstrapSupport';

describe('mainWindowBootstrapSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainWindowBootstrapSupportTestState.createdWindows.length = 0;
  });

  it('focuses an existing window by restoring, showing, and focusing only when needed', () => {
    const existingWindow = {
      isMinimized: vi.fn().mockReturnValue(true),
      restore: vi.fn(),
      isVisible: vi.fn().mockReturnValue(false),
      show: vi.fn(),
      isFocused: vi.fn().mockReturnValue(false),
      focus: vi.fn(),
    };

    expect(focusExistingMainWindow(existingWindow as never)).toBe(existingWindow);
    expect(existingWindow.restore).toHaveBeenCalledTimes(1);
    expect(existingWindow.show).toHaveBeenCalledTimes(1);
    expect(existingWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('creates the main window, applies lifecycle wiring, and sets the mac dev dock icon when available', () => {
    const app = {
      isPackaged: false,
      dock: {
        setIcon: vi.fn(),
      },
    };
    const deps = {
      app,
      moduleDir: '/app/src/main',
      title: 'Agora',
      isMac: true,
      isWindows: false,
      isDev: true,
      getMainWindow: vi.fn().mockReturnValue(null),
      setMainWindow: vi.fn(),
      getTitleBarOverlayOptions: vi.fn().mockReturnValue({ color: '#111' }),
      getWindowTheme: vi.fn().mockReturnValue('dark'),
      mainWindowLifecycle: {
        isDev: true,
        isQuitting: vi.fn(),
        devServerUrl: 'http://localhost:5175',
        emitWindowState: vi.fn(),
        scheduleReload: vi.fn(),
        openClawEngineManager: null,
        hermesEngineManager: null,
      },
      mainWindowReadyLifecycle: {
        getWindowTheme: vi.fn(),
        emitWindowState: vi.fn(),
        updateTitleBarOverlay: vi.fn(),
      },
    };
    const paths = {
      appIconPath: '/resources/tray-icon.png',
      preloadPath: '/dist-electron/preload.js',
      dockIconPath: '/build/icons/mac/icon.png',
      errorPagePath: '/resources/error.html',
      prodIndexPath: '/dist/index.html',
    };
    const options = { width: 1200 };

    mainWindowBootstrapSupportTestState.resolveMainWindowBootstrapPaths
      .mockReturnValue(paths);
    mainWindowBootstrapSupportTestState.createMainWindowOptions
      .mockReturnValue(options);
    mainWindowBootstrapSupportTestState.existsSync.mockReturnValue(true);

    const window = createMainWindow(deps as never);

    expect(
      mainWindowBootstrapSupportTestState.resolveMainWindowBootstrapPaths,
    ).toHaveBeenCalledWith({
      isPackaged: false,
      moduleDir: '/app/src/main',
      platform: process.platform,
      resourcesPath: process.resourcesPath,
    });
    expect(
      mainWindowBootstrapSupportTestState.createMainWindowOptions,
    ).toHaveBeenCalledWith({
      title: 'Agora',
      iconPath: '/resources/tray-icon.png',
      isMac: true,
      isWindows: false,
      isDev: true,
      preloadPath: '/dist-electron/preload.js',
      titleBarOverlay: { color: '#111' },
      windowTheme: 'dark',
    });
    expect(window).toBe(
      mainWindowBootstrapSupportTestState.createdWindows[0],
    );
    expect(deps.setMainWindow).toHaveBeenCalledWith(window);
    expect(window.setMenu).toHaveBeenCalledWith(null);
    expect(
      mainWindowBootstrapSupportTestState.applyWecomAuthWindowPolicies,
    ).toHaveBeenCalledWith(window);
    expect(
      mainWindowBootstrapSupportTestState.setupMainWindowLifecycle,
    ).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        ...deps.mainWindowLifecycle,
        errorPagePath: '/resources/error.html',
        prodIndexPath: '/dist/index.html',
        onWindowClosed: expect.any(Function),
      }),
    );
    expect(
      mainWindowBootstrapSupportTestState.setupMainWindowReadyLifecycle,
    ).toHaveBeenCalledWith(window, deps.mainWindowReadyLifecycle);
    expect(mainWindowBootstrapSupportTestState.createFromPath).toHaveBeenCalledWith(
      '/build/icons/mac/icon.png',
    );
    expect(app.dock.setIcon).toHaveBeenCalledWith({
      path: '/build/icons/mac/icon.png',
    });

    const onWindowClosed =
      mainWindowBootstrapSupportTestState.setupMainWindowLifecycle.mock
        .calls[0]?.[1]?.onWindowClosed as (() => void) | undefined;
    onWindowClosed?.();
    expect(deps.setMainWindow).toHaveBeenLastCalledWith(null);
  });
});
