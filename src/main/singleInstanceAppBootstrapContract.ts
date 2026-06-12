import type { App } from 'electron';

import type { AppCleanupLifecycleDeps } from './appCleanupLifecycle';
import type { AppShutdownCleanupDeps } from './appShutdownCleanup';
import type { AppStartupBootstrapDeps } from './appStartupBootstrap';
import type { AuthProtocolLifecycleDeps } from './authProtocolLifecycle';
import type { MainIpcBootstrapInputDeps } from './mainIpcBootstrap';
import type { MainWindowBootstrapDeps } from './mainWindowBootstrap';
import type { ScheduledTaskStartupBootstrapDeps } from './scheduledTaskStartupBootstrap';

export interface SingleInstanceAppBootstrapDeps {
  app: App;
  authProtocol: AuthProtocolLifecycleDeps;
  mainIpc: MainIpcBootstrapInputDeps;
  scheduledTaskStartup: ScheduledTaskStartupBootstrapDeps;
  mainWindow: MainWindowBootstrapDeps;
  appCleanup: {
    markQuitting: AppCleanupLifecycleDeps['markQuitting'];
    shutdown: AppShutdownCleanupDeps;
  };
  appStartup: Omit<
    AppStartupBootstrapDeps,
    | 'getAuthTokens'
    | 'saveAuthTokens'
    | 'getMainWindow'
    | 'createWindow'
    | 'setPendingAuthCode'
  >;
}
