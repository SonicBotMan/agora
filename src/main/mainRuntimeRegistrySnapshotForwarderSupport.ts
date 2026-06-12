import {
  type CoworkRuntimeForwarder,
  createCoworkRuntimeForwarder,
} from './coworkRuntimeForwarder';
import { resolveCurrentApiConfig } from './libs/claudeSettings';
import type { MainRuntimeRegistrySnapshotSupportDeps } from './mainRuntimeRegistrySnapshotContract';

type MainRuntimeRegistrySnapshotForwarderSupport = {
  getCoworkRuntimeForwarder: () => CoworkRuntimeForwarder;
  peekCoworkRuntimeForwarder: () => CoworkRuntimeForwarder | null;
};

function shouldBroadcastQuotaChanged(): boolean {
  try {
    const apiConfig = resolveCurrentApiConfig();
    return apiConfig.providerMetadata?.providerName === 'agora-server';
  } catch {
    return false;
  }
}

export function createMainRuntimeRegistrySnapshotForwarderSupport(
  deps: MainRuntimeRegistrySnapshotSupportDeps,
): MainRuntimeRegistrySnapshotForwarderSupport {
  let coworkRuntimeForwarder: CoworkRuntimeForwarder | null = null;

  const getCoworkRuntimeForwarder = (): CoworkRuntimeForwarder => {
    if (!coworkRuntimeForwarder) {
      coworkRuntimeForwarder = createCoworkRuntimeForwarder({
        getWindows: deps.getWindows,
        getCoworkStore: deps.getCoworkStore,
        getCoworkEngineRouter: deps.getCoworkEngineRouter,
        shouldBroadcastQuotaChanged,
      });
    }
    return coworkRuntimeForwarder;
  };

  return {
    getCoworkRuntimeForwarder,
    peekCoworkRuntimeForwarder: () => coworkRuntimeForwarder ?? null,
  };
}
