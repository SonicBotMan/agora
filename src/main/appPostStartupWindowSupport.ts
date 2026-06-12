import { app } from 'electron';

import type { AppPostStartupLifecycleDeps } from './appPostStartupLifecycleContract';

type ActivateLifecycleHost = {
  on: (event: 'activate', handler: () => void) => void;
};

type MainWindowLike = NonNullable<
  ReturnType<AppPostStartupLifecycleDeps['getMainWindow']>
>;

export function focusExistingMainWindow(
  mainWindow: MainWindowLike | null,
): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  if (!mainWindow.isVisible()) mainWindow.show();
  if (!mainWindow.isFocused()) mainWindow.focus();
  return true;
}

export function registerAppActivateLifecycle(
  getMainWindow: AppPostStartupLifecycleDeps['getMainWindow'],
  createWindow: AppPostStartupLifecycleDeps['createWindow'],
  lifecycleHost: ActivateLifecycleHost = app,
): void {
  lifecycleHost.on('activate', () => {
    if (!focusExistingMainWindow(getMainWindow())) {
      createWindow();
    }
  });
}
