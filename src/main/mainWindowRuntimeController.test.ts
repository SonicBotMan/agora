import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainWindowRuntimeControllerTestState = vi.hoisted(() => {
  const nativeTheme = { shouldUseDarkColors: false };
  const applyMainWindowProxyPreference = vi.fn();
  const emitMainWindowState = vi.fn();
  const scheduleReload = vi.fn();
  const createReloadScheduler = vi.fn(() => scheduleReload);

  return {
    nativeTheme,
    applyMainWindowProxyPreference,
    emitMainWindowState,
    scheduleReload,
    createReloadScheduler,
  };
});

vi.mock('electron', () => ({
  nativeTheme: mainWindowRuntimeControllerTestState.nativeTheme,
}));

vi.mock('./mainWindowProxySupport', async () => {
  const actual = await vi.importActual<typeof import('./mainWindowProxySupport')>(
    './mainWindowProxySupport',
  );
  return {
    ...actual,
    applyMainWindowProxyPreference:
      mainWindowRuntimeControllerTestState.applyMainWindowProxyPreference,
  };
});

vi.mock('./mainWindowStateSupport', async () => {
  const actual = await vi.importActual<typeof import('./mainWindowStateSupport')>(
    './mainWindowStateSupport',
  );
  return {
    ...actual,
    createReloadScheduler:
      mainWindowRuntimeControllerTestState.createReloadScheduler,
    emitMainWindowState: mainWindowRuntimeControllerTestState.emitMainWindowState,
  };
});

import { createMainWindowRuntimeController } from './mainWindowRuntimeController';

function createDeps(options: {
  theme?: string;
  destroyed?: boolean;
  isMac?: boolean;
  isWindows?: boolean;
} = {}) {
  const mainWindow = {
    isDestroyed: vi.fn().mockReturnValue(options.destroyed ?? false),
    setTitleBarOverlay: vi.fn(),
    setBackgroundColor: vi.fn(),
  };
  const store = {
    get: vi.fn().mockReturnValue({
      theme: options.theme,
    }),
  };
  const deps = {
    getStore: vi.fn().mockReturnValue(store),
    getMainWindow: vi.fn().mockReturnValue(mainWindow),
    isMac: options.isMac ?? false,
    isWindows: options.isWindows ?? false,
    defaultSession: { setProxy: vi.fn() },
  };

  return {
    deps,
    store,
    mainWindow,
  };
}

describe('mainWindowRuntimeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainWindowRuntimeControllerTestState.nativeTheme.shouldUseDarkColors = false;
    mainWindowRuntimeControllerTestState.createReloadScheduler.mockReturnValue(
      mainWindowRuntimeControllerTestState.scheduleReload,
    );
  });

  it('resolves theme-derived runtime options and proxies helpers from support modules', async () => {
    const { deps } = createDeps({
      theme: 'dark',
    });
    const controller = createMainWindowRuntimeController(deps as never);

    expect(controller.getUseSystemProxyFromConfig()).toBe(false);
    expect(
      controller.getUseSystemProxyFromConfig({ useSystemProxy: true }),
    ).toBe(true);
    expect(controller.getInitialTheme()).toBe('dark');
    expect(controller.getTitleBarOverlayOptions()).toEqual({
      color: '#0F1117',
      symbolColor: '#E4E5E9',
      height: 48,
    });

    await controller.applyProxyPreference(true);
    expect(
      mainWindowRuntimeControllerTestState.applyMainWindowProxyPreference,
    ).toHaveBeenCalledWith(deps.defaultSession, true);

    controller.emitWindowState();
    expect(mainWindowRuntimeControllerTestState.emitMainWindowState)
      .toHaveBeenCalledWith(deps.getMainWindow());

    controller.scheduleReload('manual');
    expect(mainWindowRuntimeControllerTestState.scheduleReload)
      .toHaveBeenCalledWith('manual');
    expect(mainWindowRuntimeControllerTestState.createReloadScheduler)
      .toHaveBeenCalledWith(deps.getMainWindow);
  });

  it('updates title bar overlay on Windows and background color on alive windows', () => {
    const { deps, mainWindow } = createDeps({
      theme: 'light',
      isWindows: true,
    });
    const controller = createMainWindowRuntimeController(deps as never);

    controller.updateTitleBarOverlay();

    expect(mainWindow.setTitleBarOverlay).toHaveBeenCalledWith({
      color: '#F3F4F6',
      symbolColor: '#1A1D23',
      height: 48,
    });
    expect(mainWindow.setBackgroundColor).toHaveBeenCalledWith('#F8F9FB');
  });

  it('skips title bar overlay on macOS and no-ops when the window is destroyed', () => {
    const mac = createDeps({
      theme: 'dark',
      isMac: true,
    });
    const destroyed = createDeps({
      destroyed: true,
      isWindows: true,
    });
    const macController = createMainWindowRuntimeController(mac.deps as never);
    const destroyedController = createMainWindowRuntimeController(
      destroyed.deps as never,
    );

    macController.updateTitleBarOverlay();
    destroyedController.updateTitleBarOverlay();

    expect(mac.mainWindow.setTitleBarOverlay).not.toHaveBeenCalled();
    expect(mac.mainWindow.setBackgroundColor).toHaveBeenCalledWith('#0F1117');
    expect(destroyed.mainWindow.setTitleBarOverlay).not.toHaveBeenCalled();
    expect(destroyed.mainWindow.setBackgroundColor).not.toHaveBeenCalled();
  });

  it('falls back to the system theme when config does not specify one', () => {
    mainWindowRuntimeControllerTestState.nativeTheme.shouldUseDarkColors = true;
    const { deps } = createDeps({
      theme: undefined,
      isWindows: true,
    });
    const controller = createMainWindowRuntimeController(deps as never);

    expect(controller.getInitialTheme()).toBe('dark');
  });
});
