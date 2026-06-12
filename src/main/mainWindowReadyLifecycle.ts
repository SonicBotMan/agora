import type { BrowserWindow } from 'electron';

import type { MainWindowReadyLifecycleDeps } from './mainWindowReadyLifecycleContract';
import { registerMainWindowReadyLifecycle } from './mainWindowReadyLifecycleSupport';

export type { MainWindowReadyLifecycleDeps } from './mainWindowReadyLifecycleContract';

export function setupMainWindowReadyLifecycle(
  window: BrowserWindow,
  deps: MainWindowReadyLifecycleDeps,
): void {
  registerMainWindowReadyLifecycle(window, deps);
}
