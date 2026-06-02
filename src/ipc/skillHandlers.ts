import type { IpcMain } from 'electron';

/**
 * Register IPC handlers for skill management operations.
 */
export function registerSkillHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('skills:list', async () => {
    console.log('[IPC] skills:list');
    throw new Error('Not implemented');
  });

  ipcMain.handle('skills:install', async (_event, skillId: string, source?: string) => {
    console.log('[IPC] skills:install', { skillId, source });
    throw new Error('Not implemented');
  });

  ipcMain.handle('skills:uninstall', async (_event, skillId: string) => {
    console.log('[IPC] skills:uninstall', { skillId });
    throw new Error('Not implemented');
  });

  ipcMain.handle('skills:toggle', async (_event, skillId: string, enabled: boolean) => {
    console.log('[IPC] skills:toggle', { skillId, enabled });
    throw new Error('Not implemented');
  });
}
