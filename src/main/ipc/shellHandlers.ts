/**
 * Agora — Shell IPC Handlers
 * Electron shell operations: opening paths, showing items in folder,
 * and opening external URLs.
 *
 * Extracted from main.ts lines 5940–5971.
 */

import { ipcMain, shell } from 'electron';

/** Platform-aware shell path normalizer. On Windows it strips the
 *  leading slash from `/C:/...` paths and decodes `file://` URIs so
 *  `shell.openPath` doesn't get confused. On macOS/Linux it's a no-op. */
export type NormalizeShellPath = (inputPath: string) => string;

export interface ShellDeps {
  /** Platform-aware path normalizer (Windows quirks). */
  normalizeShellPath: NormalizeShellPath;
}

export function registerShellHandlers(deps: ShellDeps): void {
  const { normalizeShellPath } = deps;

  // shell:openPath
  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    try {
      const normalizedPath = normalizeShellPath(filePath);
      const error = await shell.openPath(normalizedPath);
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
      const normalizedPath = normalizeShellPath(filePath);
      shell.showItemInFolder(normalizedPath);
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
