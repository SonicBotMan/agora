import type { App, BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

import type { MainWindowLifecycleDeps } from './mainWindowLifecycle';
import type { MainWindowReadyLifecycleDeps } from './mainWindowReadyLifecycle';

export interface MainWindowBootstrapDeps {
  app: App;
  moduleDir: string;
  title: string;
  isMac: boolean;
  isWindows: boolean;
  isDev: boolean;
  getMainWindow: () => BrowserWindow | null;
  setMainWindow: (window: BrowserWindow | null) => void;
  getTitleBarOverlayOptions: () => BrowserWindowConstructorOptions['titleBarOverlay'];
  getWindowTheme: () => 'light' | 'dark';
  mainWindowLifecycle: Omit<
    MainWindowLifecycleDeps,
    'errorPagePath' | 'prodIndexPath' | 'onWindowClosed'
  >;
  mainWindowReadyLifecycle: MainWindowReadyLifecycleDeps;
}
