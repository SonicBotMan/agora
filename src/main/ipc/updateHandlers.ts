/**
 * Agora — Auto-Update IPC Handlers
 * Application update download, cancel, and install.
 *
 * Extracted from main.ts lines 5974–6005.
 */

import { ipcMain } from 'electron';

import { downloadUpdate, cancelActiveDownload, installUpdate } from '../libs/appUpdateInstaller';

/**
 * Interface to read/write the SQLite KV store.
 */
export interface StoreOps {
  get<T = unknown>(key: string, defaultValue?: T): T;
}

export interface UpdateDeps {
  getStore: () => StoreOps;
}

export function registerUpdateHandlers(deps: UpdateDeps): void {
  // appUpdate:download
  ipcMain.handle('appUpdate:download', async (event, url: string) => {
    // Block downloads in enterprise mode
    const enterprise = deps.getStore().get<{ disableUpdate?: boolean }>('enterprise_config');
    if (enterprise?.disableUpdate) {
      return { success: false, error: 'Updates are managed by enterprise' };
    }
    try {
      const filePath = await downloadUpdate(url, (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('appUpdate:downloadProgress', progress);
        }
      });
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Download failed' };
    }
  });

  // appUpdate:cancelDownload
  ipcMain.handle('appUpdate:cancelDownload', async () => {
    const cancelled = cancelActiveDownload();
    return { success: cancelled };
  });

  // appUpdate:install
  ipcMain.handle('appUpdate:install', async (_event, filePath: string) => {
    try {
      await installUpdate(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Installation failed' };
    }
  });
}
