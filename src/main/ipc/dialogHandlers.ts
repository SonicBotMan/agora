/**
 * Agora — Dialog IPC Handlers
 * Native OS dialogs: file open/save, message boxes.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';

export interface DialogDeps {
  getMainWindow: () => BrowserWindow | null;
}

export function registerDialogHandlers(deps: DialogDeps): void {
  ipcMain.handle('dialog:openFile', async (_event, options: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    multiSelections?: boolean;
  }) => {
    const result = await dialog.showOpenDialog(deps.getMainWindow()!, {
      title: options.title,
      filters: options.filters,
      properties: options.multiSelections ? ['multiSelections', 'openFile'] : ['openFile'],
    });
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle('dialog:openFolder', async (_event, options?: { title?: string }) => {
    const result = await dialog.showOpenDialog(deps.getMainWindow()!, {
      title: options?.title ?? 'Select Folder',
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (_event, options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => {
    const result = await dialog.showSaveDialog(deps.getMainWindow()!, {
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:showMessageBox', async (_event, options: {
    type?: 'none' | 'info' | 'error' | 'question' | 'warning';
    title?: string;
    message: string;
    detail?: string;
    buttons?: string[];
  }) => {
    const result = await dialog.showMessageBox(deps.getMainWindow()!, options);
    return result.response;
  });

  ipcMain.handle('dialog:showErrorBox', (_event, title: string, content: string) => {
    dialog.showErrorBox(title, content);
  });
}
