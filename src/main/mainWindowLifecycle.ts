import type { BrowserWindow } from 'electron';

import type { MainWindowLifecycleDeps } from './mainWindowLifecycleContract';
import {
  registerMainWindowEventLifecycle,
  registerMainWindowLoadLifecycle,
} from './mainWindowLifecycleEventSupport';

export type {
  EngineStatusProvider,
  MainWindowLifecycleDeps,
} from './mainWindowLifecycleContract';

export function setupMainWindowLifecycle(
  window: BrowserWindow,
  deps: MainWindowLifecycleDeps,
): void {
  registerMainWindowEventLifecycle(window, deps);
  registerMainWindowLoadLifecycle(window, deps);
}
