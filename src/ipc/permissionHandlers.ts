import type { IpcMain } from 'electron';

/**
 * Register IPC handlers for permission approval/denial.
 */
export function registerPermissionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('permission:approve', async (_event, requestId: string) => {
    console.log('[IPC] permission:approve', { requestId });
    throw new Error('Not implemented');
  });

  ipcMain.handle('permission:deny', async (_event, requestId: string) => {
    console.log('[IPC] permission:deny', { requestId });
    throw new Error('Not implemented');
  });
}
