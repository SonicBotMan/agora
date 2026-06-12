import type { App, BrowserWindowConstructorOptions } from 'electron';
import { BrowserWindow, nativeImage } from 'electron';
import fs from 'fs';

import type { MainWindowBootstrapDeps } from './mainWindowBootstrapContract';
import { createMainWindowOptions } from './mainWindowBootstrapOptionSupport';
import { resolveMainWindowBootstrapPaths } from './mainWindowBootstrapPathSupport';
import { setupMainWindowLifecycle } from './mainWindowLifecycle';
import { setupMainWindowReadyLifecycle } from './mainWindowReadyLifecycle';
import { applyWecomAuthWindowPolicies } from './mainWindowSecurity';

function applyMacDevDockIcon(
  deps: Pick<MainWindowBootstrapDeps, 'app' | 'isMac' | 'isDev'>,
  dockIconPath: string,
): void {
  if (!deps.isMac || !deps.isDev) {
    return;
  }

  if (fs.existsSync(dockIconPath)) {
    deps.app.dock.setIcon(nativeImage.createFromPath(dockIconPath));
  }
}

export function focusExistingMainWindow(
  existingWindow: BrowserWindow,
): BrowserWindow {
  if (existingWindow.isMinimized()) existingWindow.restore();
  if (!existingWindow.isVisible()) existingWindow.show();
  if (!existingWindow.isFocused()) existingWindow.focus();
  return existingWindow;
}

export function createMainWindow(
  deps: MainWindowBootstrapDeps,
): BrowserWindow {
  const paths = resolveMainWindowBootstrapPaths({
    isPackaged: deps.app.isPackaged,
    moduleDir: deps.moduleDir,
    platform: process.platform,
    resourcesPath: process.resourcesPath,
  });
  const options: BrowserWindowConstructorOptions = createMainWindowOptions({
    title: deps.title,
    iconPath: paths.appIconPath,
    isMac: deps.isMac,
    isWindows: deps.isWindows,
    isDev: deps.isDev,
    preloadPath: paths.preloadPath,
    titleBarOverlay: deps.getTitleBarOverlayOptions(),
    windowTheme: deps.getWindowTheme(),
  });
  const mainWindow = new BrowserWindow(options);
  deps.setMainWindow(mainWindow);

  applyMacDevDockIcon(deps, paths.dockIconPath);
  mainWindow.setMenu(null);
  applyWecomAuthWindowPolicies(mainWindow);

  setupMainWindowLifecycle(mainWindow, {
    ...deps.mainWindowLifecycle,
    errorPagePath: paths.errorPagePath,
    prodIndexPath: paths.prodIndexPath,
    onWindowClosed: () => {
      deps.setMainWindow(null);
    },
  });

  setupMainWindowReadyLifecycle(mainWindow, deps.mainWindowReadyLifecycle);
  return mainWindow;
}
