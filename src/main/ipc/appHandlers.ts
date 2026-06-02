/**
 * Agora — App-level IPC Handlers
 * 
 * Auto-launch, prevent-sleep, version, locale, logs.
 */

import { ipcMain, app } from 'electron';

export interface AppDeps {
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enabled: boolean) => Promise<void>;
  getPreventSleep: () => boolean;
  setPreventSleep: (enabled: boolean) => void;
  getLogFilePath: () => string;
  openLogFolder: () => void;
  exportLogsZip: (options: { defaultFileName: string }) => Promise<string>;
}

export function registerAppHandlers(deps: AppDeps): void {
  // Auto-launch
  ipcMain.handle('app:getAutoLaunch', () => deps.getAutoLaunch());
  ipcMain.handle('app:setAutoLaunch', async (_event, enabled: unknown) => {
    await deps.setAutoLaunch(!!enabled);
  });

  // Prevent sleep
  ipcMain.handle('app:getPreventSleep', () => deps.getPreventSleep());
  ipcMain.handle('app:setPreventSleep', (_event, enabled: unknown) => {
    deps.setPreventSleep(!!enabled);
  });

  // App info
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getSystemLocale', () => app.getLocale());

  // Logs
  ipcMain.handle('log:getPath', () => deps.getLogFilePath());
  ipcMain.handle('log:openFolder', () => deps.openLogFolder());
  ipcMain.handle('log:exportZip', async () => {
    try {
      const defaultFileName = `agora-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
      const filePath = await deps.exportLogsZip({ defaultFileName });
      return { success: true, path: filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export logs',
      };
    }
  });
}
