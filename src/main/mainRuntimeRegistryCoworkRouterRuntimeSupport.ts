import {
  type CoworkRouterRuntime,
  createCoworkRouterRuntime,
} from './coworkRouterRuntime';
import type { IMGatewayManager } from './im';
import { getCronJobService } from './ipcHandlers/scheduledTask';
import type { CoworkAgentEngine } from './libs/agentEngine';
import type {
  HermesEngineManager,
  HermesEngineStatus,
} from './libs/hermesEngineManager';
import type { OpenClawEngineManager } from './libs/openclawEngineManager';
import type { MainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';

export interface MainRuntimeRegistryCoworkRouterRuntimeSupportDeps {
  getCoworkStore: MainRuntimeRegistrySupport['getCoworkStore'];
  getMcpBridgeRuntime: MainRuntimeRegistrySupport['getMcpBridgeRuntime'];
  getExternalAgentProviderStore: MainRuntimeRegistrySupport['getExternalAgentProviderStore'];
  getRuntimeTelemetryTracker: MainRuntimeRegistrySupport['getRuntimeTelemetryTracker'];
  getDeepSeekTuiRuntimeManager: MainRuntimeRegistrySupport['getDeepSeekTuiRuntimeManager'];
  getOpenClawEngineManager: () => OpenClawEngineManager;
  getHermesEngineManager: () => HermesEngineManager;
  ensureHermesRunningForCowork: () => Promise<HermesEngineStatus>;
  resolveCoworkAgentEngine: () => CoworkAgentEngine;
  getIMGatewayManager: () => IMGatewayManager;
}

export interface MainRuntimeRegistryCoworkRouterRuntimeSupport {
  peekCoworkEngineRouter: CoworkRouterRuntime['peekCoworkEngineRouter'];
  peekOpenClawRuntimeAdapter: CoworkRouterRuntime['peekOpenClawRuntimeAdapter'];
  getCoworkEngineRouter: CoworkRouterRuntime['getCoworkEngineRouter'];
}

export function createMainRuntimeRegistryCoworkRouterRuntimeSupport(
  deps: MainRuntimeRegistryCoworkRouterRuntimeSupportDeps,
): MainRuntimeRegistryCoworkRouterRuntimeSupport {
  let coworkRouterRuntime: CoworkRouterRuntime | null = null;

  const getCoworkRouterRuntime = (): CoworkRouterRuntime => {
    if (!coworkRouterRuntime) {
      coworkRouterRuntime = createCoworkRouterRuntime({
        getCoworkStore: deps.getCoworkStore,
        getOpenClawEngineManager: deps.getOpenClawEngineManager,
        getHermesEngineManager: deps.getHermesEngineManager,
        getDeepSeekTuiRuntimeManager: deps.getDeepSeekTuiRuntimeManager,
        getExternalAgentProviderStore: deps.getExternalAgentProviderStore,
        ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
        resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
        getRuntimeTelemetryTracker: deps.getRuntimeTelemetryTracker,
        getIMGatewayManager: deps.getIMGatewayManager,
        getCronJobService,
        getEnabledMcpServers: () =>
          deps.getMcpBridgeRuntime().getMcpStore().getEnabledServers(),
      });
    }
    return coworkRouterRuntime;
  };

  return {
    peekCoworkEngineRouter: () =>
      coworkRouterRuntime?.peekCoworkEngineRouter() ?? null,
    peekOpenClawRuntimeAdapter: () =>
      coworkRouterRuntime?.peekOpenClawRuntimeAdapter() ?? null,
    getCoworkEngineRouter: () => getCoworkRouterRuntime().getCoworkEngineRouter(),
  };
}
