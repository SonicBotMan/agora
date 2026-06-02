import type { IpcMain } from 'electron';

/**
 * Register IPC handlers for instant messaging platform operations.
 */
export function registerImHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('im:listPlatforms', async () => {
    console.log('[IPC] im:listPlatforms');
    throw new Error('Not implemented');
  });

  ipcMain.handle('im:getInstances', async (_event, platform: string) => {
    console.log('[IPC] im:getInstances', { platform });
    throw new Error('Not implemented');
  });

  ipcMain.handle('im:createInstance', async (_event, platform: string, config: Record<string, unknown>) => {
    console.log('[IPC] im:createInstance', { platform, config });
    throw new Error('Not implemented');
  });

  ipcMain.handle('im:testConnection', async (_event, instanceId: string) => {
    console.log('[IPC] im:testConnection', { instanceId });
    throw new Error('Not implemented');
  });
}
