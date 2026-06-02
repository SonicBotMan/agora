/**
 * Agora — Shell IPC Handlers
 * Electron shell operations: opening paths, showing items in folder,
 * and opening external URLs.
 *
 * Extracted from main.ts lines 5940–5971.
 */

import { ipcMain, shell } from 'electron';

export interface ShellDeps {
  // No deps needed — shell module is imported directly from Electron.
}

export function registerShellHandlers(_deps: ShellDeps): void {
  // shell:openPath
  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    try {
      const error = await shell.openPath(filePath);
      if (error) {
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open path',
      };
    }
  });

  // shell:showItemInFolder
  ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to show item in folder',
      };
    }
  });

  // shell:openExternal
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open external URL',
      };
    }
  });
}
