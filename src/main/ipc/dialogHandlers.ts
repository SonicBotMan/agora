/**
 * Agora — Dialog IPC Handlers
 * Native OS dialogs: directory selection, file open/save, inline file saving,
 * image storage, and reading files as data URLs.
 *
 * Extracted from main.ts lines 5751–5937.
 */

import { BrowserWindow, ipcMain } from 'electron';

import { AttachmentHandler } from '../../core/AttachmentHandler';
import { DialogIpcChannel } from '../../shared/dialog/constants';

// ── Deps interface ──

export interface DialogDeps {
  getMainWindow: () => BrowserWindow | null;
}

// ── Handler registration ──

export function registerDialogHandlers(_deps: DialogDeps): void {
  const attachmentHandler = new AttachmentHandler();

  // dialog:selectDirectory
  ipcMain.handle('dialog:selectDirectory', async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    return attachmentHandler.selectDirectory(ownerWindow);
  });

  // dialog:selectFile
  ipcMain.handle(
    'dialog:selectFile',
    async (event, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      return attachmentHandler.selectFile(ownerWindow, options);
    },
  );

  // dialog:selectFiles
  ipcMain.handle(
    'dialog:selectFiles',
    async (event, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      return attachmentHandler.selectFiles(ownerWindow, options);
    },
  );

  // dialog:saveLocalImageToDirectory (DialogIpcChannel.SaveLocalImageToDirectory)
  ipcMain.handle(
    DialogIpcChannel.SaveLocalImageToDirectory,
    async (
      event,
      options?: { sourcePath?: string; fileName?: string },
    ): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }> => {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      return attachmentHandler.saveLocalImageToDirectory(ownerWindow, options);
    },
  );

  // dialog:saveInlineFile
  ipcMain.handle(
    'dialog:saveInlineFile',
    async (
      _event,
      options?: { dataBase64?: string; fileName?: string; mimeType?: string; cwd?: string },
    ) => {
      return attachmentHandler.saveInlineFile(options);
    },
  );

  // dialog:readFileAsDataUrl
  ipcMain.handle(
    'dialog:readFileAsDataUrl',
    async (_event, filePath?: string): Promise<{ success: boolean; dataUrl?: string; error?: string }> => {
      return attachmentHandler.readFileAsDataUrl(filePath);
    },
  );
}
