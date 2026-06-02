/**
 * Agora — Window IPC Handlers
 * 
 * Window control: minimize, maximize, close, system menu.
 * Pure pass-through to Electron BrowserWindow API.
 */

import { ipcMain, BrowserWindow } from 'electron';

export function registerWindowHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on('window-minimize', () => {
    getMainWindow()?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    const win = getMainWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    getMainWindow()?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return getMainWindow()?.isMaximized() ?? false;
  });

  ipcMain.on('window:showSystemMenu', (_event, position?: { x?: number; y?: number }) => {
    const win = getMainWindow();
    if (!win) return;
    const menu = Menu.getApplicationMenu();
    if (!menu) return;
    const { x, y } = position ?? { x: undefined, y: undefined };
    menu.popup({ window: win, x, y });
  });
}

import { Menu } from 'electron';
