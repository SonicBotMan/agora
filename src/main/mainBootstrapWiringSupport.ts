import type { App, BrowserWindow } from 'electron';

import type { createMainRuntimeRegistry } from './mainRuntimeRegistry';
import type { MainWindowRuntimeController } from './mainWindowRuntimeController';

export type MainRuntimeRegistry = ReturnType<typeof createMainRuntimeRegistry>;

export type MainBootstrapState = {
  getMainWindow: () => BrowserWindow | null;
  setMainWindow: (window: BrowserWindow | null) => void;
  isQuitting: () => boolean;
  markQuitting: () => void;
};

export interface MainBootstrapWiringDeps {
  app: App;
  moduleDir: string;
  isDev: boolean;
  isMac: boolean;
  isWindows: boolean;
  devServerUrl?: string;
  normalizeShellPath: (
    value: string,
    delimiter?: string,
  ) => string;
  runtime: MainRuntimeRegistry;
  windowController: MainWindowRuntimeController;
  state: MainBootstrapState;
}
