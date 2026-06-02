/**
 * Agora — Shell IPC Handlers
 * Secure command execution and shell utilities.
 */

import { ipcMain, shell } from 'electron';

export interface ShellDeps {
  executeCommand: (command: string, options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  }) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export function registerShellHandlers(deps: ShellDeps): void {
  ipcMain.handle('shell:execute', async (_event, command: string, options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  }) => {
    try {
      const result = await deps.executeCommand(command, options);
      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
        exitCode: -1,
      };
    }
  });

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:openPath', async (_event, path: string) => {
    await shell.openPath(path);
  });

  ipcMain.handle('shell:showItemInFolder', (_event, fullPath: string) => {
    shell.showItemInFolder(fullPath);
  });
}
