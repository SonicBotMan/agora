import { describe, expect, it, vi } from 'vitest';

vi.mock('./autoLaunchManager', () => ({
  isAutoLaunched: vi.fn(),
}));

vi.mock('./i18n', () => ({
  setLanguage: vi.fn(),
}));

vi.mock('./ipcHandlers/scheduledTask', () => ({
  getCronJobService: vi.fn(),
}));

vi.mock('./trayManager', () => ({
  createTray: vi.fn(),
}));

import { isAutoLaunched } from './autoLaunchManager';
import { setLanguage } from './i18n';
import { getCronJobService } from './ipcHandlers/scheduledTask';
import { createMainWindowBootstrapDeps } from './mainBootstrapMainWindowSupport';
import { createTray } from './trayManager';

describe('mainBootstrapMainWindowSupport', () => {
  it('maps main window bootstrap deps and preserves lazy runtime lookups', () => {
    const store = {
      get: vi.fn().mockReturnValue({ language: 'zh' }),
    };
    const openClawEngineManager = {
      getStateDir: vi.fn().mockReturnValue('/tmp/openclaw'),
    };
    const hermesEngineManager = { id: 'hermes-engine' };
    const runtime = {
      peekOpenClawEngineManager: vi.fn().mockReturnValue(openClawEngineManager),
      peekHermesEngineManager: vi.fn().mockReturnValue(hermesEngineManager),
      getStore: vi.fn().mockReturnValue(store),
      getOpenClawEngineManager: vi.fn().mockReturnValue(openClawEngineManager),
    };
    const state = {
      getMainWindow: vi.fn(),
      setMainWindow: vi.fn(),
      isQuitting: vi.fn(),
    };
    const windowController = {
      getTitleBarOverlayOptions: vi.fn(),
      getInitialTheme: vi.fn(),
      emitWindowState: vi.fn(),
      scheduleReload: vi.fn(),
    };
    const app = {
      getName: vi.fn().mockReturnValue('Agora'),
    };
    const deps = {
      app,
      moduleDir: '/app/main',
      isMac: true,
      isWindows: false,
      isDev: true,
      devServerUrl: 'http://localhost:5175',
      runtime,
      state,
      windowController,
    };

    const result = createMainWindowBootstrapDeps(deps as never);

    expect(result.app).toBe(app);
    expect(result.moduleDir).toBe('/app/main');
    expect(result.title).toBe('Agora');
    expect(app.getName).toHaveBeenCalledTimes(1);
    expect(result.isMac).toBe(true);
    expect(result.isWindows).toBe(false);
    expect(result.isDev).toBe(true);
    expect(result.getMainWindow).toBe(state.getMainWindow);
    expect(result.setMainWindow).toBe(state.setMainWindow);
    expect(result.getTitleBarOverlayOptions).toBe(
      windowController.getTitleBarOverlayOptions,
    );
    expect(result.getWindowTheme).toBe(windowController.getInitialTheme);
    expect(result.mainWindowLifecycle).toEqual({
      isDev: true,
      isQuitting: state.isQuitting,
      devServerUrl: 'http://localhost:5175',
      emitWindowState: windowController.emitWindowState,
      scheduleReload: windowController.scheduleReload,
      openClawEngineManager,
      hermesEngineManager,
    });
    expect(runtime.peekOpenClawEngineManager).toHaveBeenCalledTimes(1);
    expect(runtime.peekHermesEngineManager).toHaveBeenCalledTimes(1);

    expect(result.mainWindowReadyLifecycle.emitWindowState).toBe(
      windowController.emitWindowState,
    );
    expect(result.mainWindowReadyLifecycle.isAutoLaunched).toBe(isAutoLaunched);
    expect(result.mainWindowReadyLifecycle.setLanguage).toBe(setLanguage);
    expect(result.mainWindowReadyLifecycle.getCronJobService).toBe(
      getCronJobService,
    );
    expect(result.mainWindowReadyLifecycle.getStore).toBe(runtime.getStore);

    expect(result.mainWindowReadyLifecycle.getAppLanguage()).toBe('zh');
    expect(runtime.getStore).toHaveBeenCalledTimes(1);
    expect(store.get).toHaveBeenCalledWith('app_config');

    result.mainWindowReadyLifecycle.createTray();
    expect(createTray).toHaveBeenCalledWith(state.getMainWindow);

    expect(result.mainWindowReadyLifecycle.getOpenClawStateDir()).toBe(
      '/tmp/openclaw',
    );
    expect(runtime.getOpenClawEngineManager).toHaveBeenCalledTimes(1);
    expect(openClawEngineManager.getStateDir).toHaveBeenCalledTimes(1);
  });
});
