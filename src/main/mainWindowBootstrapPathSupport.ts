import path from 'path';

export interface MainWindowBootstrapPathInput {
  isPackaged: boolean;
  moduleDir: string;
  platform: NodeJS.Platform;
  resourcesPath: string;
}

export interface MainWindowBootstrapPaths {
  preloadPath: string;
  appIconPath?: string;
  dockIconPath: string;
  errorPagePath: string;
  prodIndexPath: string;
}

function resolvePreloadPath(input: MainWindowBootstrapPathInput): string {
  return input.isPackaged
    ? path.join(input.moduleDir, 'preload.js')
    : path.join(input.moduleDir, '../dist-electron/preload.js');
}

function resolveAppIconPath(
  input: MainWindowBootstrapPathInput,
): string | undefined {
  if (input.platform !== 'win32' && input.platform !== 'linux') {
    return undefined;
  }

  const basePath = input.isPackaged
    ? path.join(input.resourcesPath, 'tray')
    : path.join(input.moduleDir, '..', 'resources', 'tray');

  return input.platform === 'win32'
    ? path.join(basePath, 'tray-icon.ico')
    : path.join(basePath, 'tray-icon.png');
}

export function resolveMainWindowBootstrapPaths(
  input: MainWindowBootstrapPathInput,
): MainWindowBootstrapPaths {
  return {
    preloadPath: resolvePreloadPath(input),
    appIconPath: resolveAppIconPath(input),
    dockIconPath: path.join(input.moduleDir, '../build/icons/mac/icon.png'),
    errorPagePath: path.join(input.moduleDir, '../resources/error.html'),
    prodIndexPath: path.join(input.moduleDir, '../dist/index.html'),
  };
}
