/**
 * Agora — Log IPC Handlers
 * Application log file management: get path, open folder, export as ZIP.
 *
 * Extracted from main.ts lines 2705–2758.
 */

import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron';
import path from 'path';

import { getLogFilePath, getRecentMainLogEntries } from '../logger';
import { exportLogsZip } from '../libs/logExport';
import { getCoworkLogPath } from '../libs/coworkLogger';

// ── Helper functions (extracted from main.ts) ──

const padTwoDigits = (value: number): string => value.toString().padStart(2, '0');

const buildLogExportFileName = (): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${padTwoDigits(now.getMonth() + 1)}${padTwoDigits(now.getDate())}`;
  const timePart = `${padTwoDigits(now.getHours())}${padTwoDigits(now.getMinutes())}${padTwoDigits(now.getSeconds())}`;
  return `agora-logs-${datePart}-${timePart}.zip`;
};

const ensureZipFileName = (value: string): string => {
  return value.toLowerCase().endsWith('.zip') ? value : `${value}.zip`;
};

// ── Deps interface ──

export interface LogDeps {
  // No deps needed — all dependencies are imported directly.
}

// ── Handler registration ──

export function registerLogHandlers(_deps: LogDeps): void {
  // log:getPath
  ipcMain.handle('log:getPath', () => {
    return getLogFilePath();
  });

  // log:openFolder
  ipcMain.handle('log:openFolder', () => {
    const logPath = getLogFilePath();
    if (logPath) {
      shell.showItemInFolder(logPath);
    }
  });

  // log:exportZip
  ipcMain.handle('log:exportZip', async (event) => {
    try {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      if (!ownerWindow || ownerWindow.isDestroyed()) {
        return { success: false, error: 'Window is not available' };
      }

      const saveOptions = {
        title: 'Export Logs',
        defaultPath: path.join(app.getPath('downloads'), buildLogExportFileName()),
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      };

      const saveResult = await dialog.showSaveDialog(ownerWindow, saveOptions);

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: true, canceled: true };
      }

      const outputPath = ensureZipFileName(saveResult.filePath);
      const archiveResult = await exportLogsZip({
        outputPath,
        entries: [
          ...getRecentMainLogEntries(),
          { archiveName: 'cowork.log', filePath: getCoworkLogPath() },
        ],
      });

      return {
        success: true,
        canceled: false,
        path: outputPath,
        missingEntries: archiveResult.missingEntries,
      };
    } catch (error) {
      console.error('[LogExport] export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export logs',
      };
    }
  });
}
