import type { BrowserWindow, WebContents } from 'electron';

const MIN_RELOAD_INTERVAL_MS = 5000;

type WindowStateWebContents = Pick<
  WebContents,
  'isDestroyed' | 'send' | 'reloadIgnoringCache'
>;

type WindowStateBrowserWindow = Pick<
  BrowserWindow,
  | 'isDestroyed'
  | 'isMaximized'
  | 'isFullScreen'
  | 'isFocused'
  | 'webContents'
>;

export function emitMainWindowState(
  mainWindow: WindowStateBrowserWindow | null,
): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDestroyed()) return;

  mainWindow.webContents.send('window:state-changed', {
    isMaximized: mainWindow.isMaximized(),
    isFullscreen: mainWindow.isFullScreen(),
    isFocused: mainWindow.isFocused(),
  });
}

export function createReloadScheduler(
  getMainWindow: () => Pick<BrowserWindow, 'webContents'> | null,
): (reason: string, webContents?: WindowStateWebContents) => void {
  let lastReloadAt = 0;

  return (reason: string, webContents?: WindowStateWebContents): void => {
    const target = webContents ?? getMainWindow()?.webContents;
    if (!target || target.isDestroyed()) {
      return;
    }

    const now = Date.now();
    if (now - lastReloadAt < MIN_RELOAD_INTERVAL_MS) {
      console.warn(
        `Skipping reload (${reason}); last reload was ${now - lastReloadAt}ms ago.`,
      );
      return;
    }

    lastReloadAt = now;
    console.warn(`Reloading window due to ${reason}`);
    target.reloadIgnoringCache();
  };
}
