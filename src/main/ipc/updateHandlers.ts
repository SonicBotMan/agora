/**
 * Agora — Auto-Update IPC Handlers
 * electron-updater integration: check, download, install.
 */

import { ipcMain } from 'electron';

export interface UpdateDeps {
  checkForUpdates: () => Promise<{ available: boolean; version?: string; releaseNotes?: string }>;
  downloadUpdate: () => Promise<{ downloaded: boolean; error?: string }>;
  installUpdate: () => void;
  getUpdateProgress: () => { percent: number; bytesPerSecond: number; transferred: number; total: number } | null;
}

export function registerUpdateHandlers(deps: UpdateDeps): void {
  ipcMain.handle('update:check', async () => {
    return deps.checkForUpdates();
  });

  ipcMain.handle('update:download', async () => {
    return deps.downloadUpdate();
  });

  ipcMain.handle('update:install', () => {
    deps.installUpdate();
  });

  ipcMain.handle('update:getProgress', () => {
    return deps.getUpdateProgress();
  });
}
