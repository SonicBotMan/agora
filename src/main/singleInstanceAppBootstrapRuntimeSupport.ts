import { registerAppCleanupLifecycle } from './appCleanupLifecycle';
import { runAppShutdownCleanup } from './appShutdownCleanup';
import { bootstrapAppStartup } from './appStartupBootstrap';
import { registerWindowAllClosedLifecycle } from './appWindowLifecycle';
import { registerAuthProtocolLifecycle } from './authProtocolLifecycle';
import {
  type MainIpcAuthRuntimeDeps,
  registerMainIpcBootstrap,
} from './mainIpcBootstrap';
import { bootstrapScheduledTaskStartup } from './scheduledTaskStartupBootstrap';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrapContract';
import {
  createAppStartupRuntimeDeps,
  createBootstrappedMainIpcDeps,
  createMainIpcAuthRuntimeDeps,
} from './singleInstanceAppBootstrapSupport';

export function runSingleInstanceAppBootstrap(
  deps: SingleInstanceAppBootstrapDeps,
): void {
  const authProtocolRuntime = registerAuthProtocolLifecycle(deps.authProtocol);
  const mainIpcAuthRuntimeDeps: MainIpcAuthRuntimeDeps =
    createMainIpcAuthRuntimeDeps(authProtocolRuntime);

  const { getAuthTokens, saveAuthTokens } = registerMainIpcBootstrap(
    createBootstrappedMainIpcDeps(deps.mainIpc, mainIpcAuthRuntimeDeps),
  );

  bootstrapScheduledTaskStartup(deps.scheduledTaskStartup);

  registerAppCleanupLifecycle({
    markQuitting: deps.appCleanup.markQuitting,
    runCleanup: () => runAppShutdownCleanup(deps.appCleanup.shutdown),
  });

  void bootstrapAppStartup(
    createAppStartupRuntimeDeps(deps, authProtocolRuntime, {
      getAuthTokens,
      saveAuthTokens,
    }),
  ).catch(console.error);

  registerWindowAllClosedLifecycle(deps.app);
}
