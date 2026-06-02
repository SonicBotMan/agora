/**
 * Agora — Log IPC Handlers
 * Application log management and export.
 */

import { ipcMain } from 'electron';

export interface LogDeps {
  getLogPath: () => string;
  getRecentLogs: (lines: number) => string[];
  clearLogs: () => Promise<void>;
}

export function registerLogHandlers(deps: LogDeps): void {
  ipcMain.handle('log:getPath', () => deps.getLogPath());

  ipcMain.handle('log:getRecent', (_event, lines: number = 100) => {
    return deps.getRecentLogs(lines);
  });

  ipcMain.handle('log:clear', async () => {
    await deps.clearLogs();
  });
}
