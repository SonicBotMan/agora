import type { App, BrowserWindow } from 'electron';

import { createMainRuntimeRegistryRuntimeSupport } from './mainRuntimeRegistryRuntimeSupport';
import { createMainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';

export interface MainRuntimeRegistryDeps {
  app: App;
  getWindows: () => BrowserWindow[];
}

export function createMainRuntimeRegistry(
  deps: MainRuntimeRegistryDeps,
) {
  let runtimeSupport!: ReturnType<typeof createMainRuntimeRegistryRuntimeSupport>;
  const support = createMainRuntimeRegistrySupport({
    app: deps.app,
    getWindows: deps.getWindows,
    getCoworkEngineRouter: () => runtimeSupport.getCoworkEngineRouter(),
    getIMGatewayManager: () => runtimeSupport.getIMGatewayManager(),
    syncOpenClawConfig: (options) => runtimeSupport.syncOpenClawConfig(options),
  });

  runtimeSupport = createMainRuntimeRegistryRuntimeSupport({
    getWindows: deps.getWindows,
    support,
  });

  return {
    ...support,
    ...runtimeSupport,
  };
}
