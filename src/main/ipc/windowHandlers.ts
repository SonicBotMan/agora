/**
 * Agora — Window IPC Handlers
 *
 * Window control: minimize, maximize, close, system menu.
 * Extracted from main.ts to keep the main process entrypoint focused.
 */

import { BrowserWindow, ipcMain, Menu } from 'electron';

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

  /**
   * Show the window system menu (Windows-only custom title bar context menu).
   * Builds a template with Restore / Minimize / Maximize / Close entries.
   * Mirrors the original implementation from main.ts.
   */
  ipcMain.on('window:showSystemMenu', (_event, position?: { x?: number; y?: number }) => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;

    const isMaximized = win.isMaximized();
    const menu = Menu.buildFromTemplate([
      { label: 'Restore', enabled: isMaximized, click: () => win.restore() },
      { role: 'minimize' },
      { label: 'Maximize', enabled: !isMaximized, click: () => win.maximize() },
      { type: 'separator' },
      { role: 'close' },
    ]);

    menu.popup({
      window: win,
      x: Math.max(0, Math.round(position?.x ?? 0)),
      y: Math.max(0, Math.round(position?.y ?? 0)),
    });
  });
}
