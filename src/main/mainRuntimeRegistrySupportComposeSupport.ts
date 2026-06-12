import { createMainRuntimeRegistryServiceSupport } from './mainRuntimeRegistryServiceSupport';
import { createMainRuntimeRegistrySnapshotSupport } from './mainRuntimeRegistrySnapshotSupport';
import { createMainRuntimeRegistryStoreSupport } from './mainRuntimeRegistryStoreSupport';
import type {
  MainRuntimeRegistrySupport,
  MainRuntimeRegistrySupportDeps,
} from './mainRuntimeRegistrySupportContract';

export function createMainRuntimeRegistrySupportCompose(
  deps: MainRuntimeRegistrySupportDeps,
): MainRuntimeRegistrySupport {
  const storeSupport = createMainRuntimeRegistryStoreSupport({
    app: deps.app,
  });
  const snapshotSupport = createMainRuntimeRegistrySnapshotSupport({
    getWindows: deps.getWindows,
    getStore: storeSupport.getStore,
    getCoworkStore: storeSupport.getCoworkStore,
    getCoworkEngineRouter: deps.getCoworkEngineRouter,
  });
  const serviceSupport = createMainRuntimeRegistryServiceSupport({
    getStore: storeSupport.getStore,
    getWindows: deps.getWindows,
    getIMGatewayManager: deps.getIMGatewayManager,
    syncOpenClawConfig: deps.syncOpenClawConfig,
  });

  return {
    ...storeSupport,
    ...snapshotSupport,
    ...serviceSupport,
  };
}
