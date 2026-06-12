import {
  createAppCleanupDeps,
  createAppStartupDeps,
  createMainWindowBootstrapDeps,
  createScheduledTaskStartupDeps,
} from './mainBootstrapAppSupport';
import {
  createMainIpcBootstrapDeps,
} from './mainBootstrapIpcSupport';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrap';

export type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';

export function createMainBootstrapWiring(
  deps: MainBootstrapWiringDeps,
): SingleInstanceAppBootstrapDeps {
  return {
    app: deps.app,
    authProtocol: {
      app: deps.app,
      getMainWindow: deps.state.getMainWindow,
    },
    mainIpc: createMainIpcBootstrapDeps(deps),
    scheduledTaskStartup: createScheduledTaskStartupDeps(deps),
    mainWindow: createMainWindowBootstrapDeps(deps),
    appCleanup: createAppCleanupDeps(deps),
    appStartup: createAppStartupDeps(deps),
  };
}
