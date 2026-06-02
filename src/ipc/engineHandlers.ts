import type { IpcMain } from 'electron';

/**
 * Register IPC handlers for engine management operations.
 */
export function registerEngineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('engine:getStatus', async (_event, engineName: string) => {
    console.log('[IPC] engine:getStatus', { engineName });
    throw new Error('Not implemented');
  });

  ipcMain.handle('engine:install', async (_event, engineName: string, version?: string) => {
    console.log('[IPC] engine:install', { engineName, version });
    throw new Error('Not implemented');
  });

  ipcMain.handle('engine:configure', async (_event, engineName: string, config: Record<string, unknown>) => {
    console.log('[IPC] engine:configure', { engineName, config });
    throw new Error('Not implemented');
  });
}
