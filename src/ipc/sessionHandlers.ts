import type { IpcMain } from 'electron';

/**
 * Register IPC handlers for session lifecycle operations.
 */
export function registerSessionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('session:start', async (_event, sessionId: string, prompt: string) => {
    console.log('[IPC] session:start', { sessionId, prompt });
    throw new Error('Not implemented');
  });

  ipcMain.handle('session:continue', async (_event, sessionId: string, prompt: string) => {
    console.log('[IPC] session:continue', { sessionId, prompt });
    throw new Error('Not implemented');
  });

  ipcMain.handle('session:stop', async (_event, sessionId: string) => {
    console.log('[IPC] session:stop', { sessionId });
    throw new Error('Not implemented');
  });

  ipcMain.handle('session:delete', async (_event, sessionId: string) => {
    console.log('[IPC] session:delete', { sessionId });
    throw new Error('Not implemented');
  });

  ipcMain.handle('session:list', async () => {
    console.log('[IPC] session:list');
    throw new Error('Not implemented');
  });

  ipcMain.handle('session:get', async (_event, sessionId: string) => {
    console.log('[IPC] session:get', { sessionId });
    throw new Error('Not implemented');
  });
}
