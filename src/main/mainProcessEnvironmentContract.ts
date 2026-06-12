import type { App, WebContents } from 'electron';

export interface MainProcessLifecycleDeps {
  scheduleReload: (reason: string, webContents?: WebContents) => void;
}

export interface MainProcessEnvironment {
  isDev: boolean;
  isMac: boolean;
  isWindows: boolean;
  devServerUrl: string;
  normalizeShellPath: (inputPath: string) => string;
  registerLifecycleHandlers: (deps: MainProcessLifecycleDeps) => void;
}

export interface MainProcessEnvironmentFlags {
  isDev: boolean;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  devServerUrl: string;
  enableVerboseLogging: boolean;
  disableGpu: boolean;
  reloadOnChildProcessGone: boolean;
}

export type MainProcessApp = Pick<
  App,
  | 'commandLine'
  | 'configureHostResolver'
  | 'disableHardwareAcceleration'
  | 'getPath'
  | 'isReady'
  | 'on'
  | 'setPath'
>;
