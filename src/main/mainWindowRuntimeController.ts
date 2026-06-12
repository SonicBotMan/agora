import type {
  BrowserWindow,
  Session,
  WebContents,
} from 'electron';
import { nativeTheme } from 'electron';

import {
  applyMainWindowProxyPreference,
  getUseSystemProxyFromConfig,
} from './mainWindowProxySupport';
import {
  createReloadScheduler,
  emitMainWindowState,
} from './mainWindowStateSupport';
import {
  type AppConfigSettings,
  createTitleBarOverlayOptions,
  type MainWindowTheme,
  resolveThemeFromConfig,
  resolveWindowBackgroundColor,
  type TitleBarOverlayOptions,
} from './mainWindowThemeSupport';
import type { SqliteStore } from './sqliteStore';

export interface MainWindowRuntimeControllerDeps {
  getStore: () => SqliteStore;
  getMainWindow: () => BrowserWindow | null;
  isMac: boolean;
  isWindows: boolean;
  defaultSession: Session;
}

export interface MainWindowRuntimeController {
  getUseSystemProxyFromConfig: (
    config?: { useSystemProxy?: boolean },
  ) => boolean;
  getInitialTheme: () => 'light' | 'dark';
  getTitleBarOverlayOptions: () => TitleBarOverlayOptions;
  updateTitleBarOverlay: () => void;
  applyProxyPreference: (useSystemProxy: boolean) => Promise<void>;
  emitWindowState: () => void;
  scheduleReload: (reason: string, webContents?: WebContents) => void;
}

export function createMainWindowRuntimeController(
  deps: MainWindowRuntimeControllerDeps,
): MainWindowRuntimeController {
  const resolveCurrentTheme = (): MainWindowTheme => {
    const config = deps.getStore().get<AppConfigSettings>('app_config');
    return resolveThemeFromConfig(config, nativeTheme.shouldUseDarkColors);
  };

  const getInitialTheme = (): 'light' | 'dark' => {
    return resolveCurrentTheme();
  };

  const getTitleBarOverlayOptions = (): TitleBarOverlayOptions => {
    return createTitleBarOverlayOptions(resolveCurrentTheme());
  };

  const updateTitleBarOverlay = (): void => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (!deps.isMac) {
      mainWindow.setTitleBarOverlay(getTitleBarOverlayOptions());
    }

    mainWindow.setBackgroundColor(
      resolveWindowBackgroundColor(resolveCurrentTheme()),
    );
  };

  const applyProxyPreference = async (
    useSystemProxy: boolean,
  ): Promise<void> => {
    await applyMainWindowProxyPreference(deps.defaultSession, useSystemProxy);
  };

  const emitWindowState = (): void => {
    emitMainWindowState(deps.getMainWindow());
  };

  const scheduleReload = createReloadScheduler(deps.getMainWindow);

  return {
    getUseSystemProxyFromConfig,
    getInitialTheme,
    getTitleBarOverlayOptions,
    updateTitleBarOverlay,
    applyProxyPreference,
    emitWindowState,
    scheduleReload,
  };
}
