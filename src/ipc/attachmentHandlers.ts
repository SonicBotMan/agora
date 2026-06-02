import type { IpcMain } from 'electron';

/**
 * Register IPC handlers for file attachment operations.
 */
export function registerAttachmentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('attachment:upload', async (_event, sessionId: string, filePath: string) => {
    console.log('[IPC] attachment:upload', { sessionId, filePath });
    throw new Error('Not implemented');
  });

  ipcMain.handle('attachment:download', async (_event, attachmentId: string) => {
    console.log('[IPC] attachment:download', { attachmentId });
    throw new Error('Not implemented');
  });

  ipcMain.handle('attachment:preview', async (_event, attachmentId: string) => {
    console.log('[IPC] attachment:preview', { attachmentId });
    throw new Error('Not implemented');
  });
}
