import type { App } from 'electron';

export function registerWindowAllClosedLifecycle(app: App): void {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
