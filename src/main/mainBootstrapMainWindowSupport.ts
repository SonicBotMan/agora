import { isAutoLaunched } from './autoLaunchManager';
import { setLanguage } from './i18n';
import { getCronJobService } from './ipcHandlers/scheduledTask';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrap';
import { createTray } from './trayManager';

export function createMainWindowBootstrapDeps(
  deps: MainBootstrapWiringDeps,
): SingleInstanceAppBootstrapDeps['mainWindow'] {
  const { runtime, windowController, state } = deps;

  return {
    app: deps.app,
    moduleDir: deps.moduleDir,
    title: deps.app.getName(),
    isMac: deps.isMac,
    isWindows: deps.isWindows,
    isDev: deps.isDev,
    getMainWindow: state.getMainWindow,
    setMainWindow: state.setMainWindow,
    getTitleBarOverlayOptions: windowController.getTitleBarOverlayOptions,
    getWindowTheme: windowController.getInitialTheme,
    mainWindowLifecycle: {
      isDev: deps.isDev,
      isQuitting: state.isQuitting,
      devServerUrl: deps.devServerUrl,
      emitWindowState: windowController.emitWindowState,
      scheduleReload: windowController.scheduleReload,
      openClawEngineManager: runtime.peekOpenClawEngineManager(),
      hermesEngineManager: runtime.peekHermesEngineManager(),
    },
    mainWindowReadyLifecycle: {
      emitWindowState: windowController.emitWindowState,
      isAutoLaunched,
      getAppLanguage: () =>
        runtime.getStore().get<{ language?: string }>('app_config')?.language,
      setLanguage,
      createTray: () => {
        createTray(state.getMainWindow);
      },
      getCronJobService,
      getStore: runtime.getStore,
      getOpenClawStateDir: () => runtime.getOpenClawEngineManager().getStateDir(),
    },
  };
}
