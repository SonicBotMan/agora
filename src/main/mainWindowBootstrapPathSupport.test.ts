import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveMainWindowBootstrapPaths } from './mainWindowBootstrapPathSupport';

describe('resolveMainWindowBootstrapPaths', () => {
  const moduleDir = '/tmp/agora/dist-electron';
  const resourcesPath = '/tmp/agora/resources';

  it('resolves development paths for linux', () => {
    expect(
      resolveMainWindowBootstrapPaths({
        isPackaged: false,
        moduleDir,
        platform: 'linux',
        resourcesPath,
      }),
    ).toEqual({
      preloadPath: path.join(moduleDir, '../dist-electron/preload.js'),
      appIconPath: path.join(moduleDir, '..', 'resources', 'tray', 'tray-icon.png'),
      dockIconPath: path.join(moduleDir, '../build/icons/mac/icon.png'),
      errorPagePath: path.join(moduleDir, '../resources/error.html'),
      prodIndexPath: path.join(moduleDir, '../dist/index.html'),
    });
  });

  it('resolves packaged paths for windows', () => {
    expect(
      resolveMainWindowBootstrapPaths({
        isPackaged: true,
        moduleDir,
        platform: 'win32',
        resourcesPath,
      }),
    ).toEqual({
      preloadPath: path.join(moduleDir, 'preload.js'),
      appIconPath: path.join(resourcesPath, 'tray', 'tray-icon.ico'),
      dockIconPath: path.join(moduleDir, '../build/icons/mac/icon.png'),
      errorPagePath: path.join(moduleDir, '../resources/error.html'),
      prodIndexPath: path.join(moduleDir, '../dist/index.html'),
    });
  });

  it('omits app icon on macOS', () => {
    expect(
      resolveMainWindowBootstrapPaths({
        isPackaged: true,
        moduleDir,
        platform: 'darwin',
        resourcesPath,
      }).appIconPath,
    ).toBeUndefined();
  });
});
