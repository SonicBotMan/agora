import type { BrowserWindow } from 'electron';

import type { MainWindowBootstrapDeps } from './mainWindowBootstrapContract';
import {
  createMainWindow,
  focusExistingMainWindow,
} from './mainWindowBootstrapSupport';

export type { MainWindowBootstrapDeps } from './mainWindowBootstrapContract';

export function createOrFocusMainWindow(
  deps: MainWindowBootstrapDeps,
): BrowserWindow {
  const existingWindow = deps.getMainWindow();
  if (existingWindow) {
    return focusExistingMainWindow(existingWindow);
  }

  return createMainWindow(deps);
}
