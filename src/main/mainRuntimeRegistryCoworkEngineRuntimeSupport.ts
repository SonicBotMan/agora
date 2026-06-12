import {
  type CoworkEngineRuntime,
  createCoworkEngineRuntime,
} from './coworkEngineRuntime';
import { getCronJobService } from './ipcHandlers/scheduledTask';
import { ensureDefaultIdentity } from './libs/openclawMemoryFile';
import {
  type MainRuntimeRegistryCoworkEngineRuntimeSupport,
  type MainRuntimeRegistryCoworkEngineRuntimeSupportDeps,
} from './mainRuntimeRegistryCoworkEngineRuntimeContract';
import { createMainRuntimeRegistryCoworkEngineRuntimeView } from './mainRuntimeRegistryCoworkEngineRuntimeViewSupport';

export type {
  MainRuntimeRegistryCoworkEngineRuntimeSupport,
  MainRuntimeRegistryCoworkEngineRuntimeSupportDeps,
} from './mainRuntimeRegistryCoworkEngineRuntimeContract';

export function createMainRuntimeRegistryCoworkEngineRuntimeSupport(
  deps: MainRuntimeRegistryCoworkEngineRuntimeSupportDeps,
): MainRuntimeRegistryCoworkEngineRuntimeSupport {
  let coworkEngineRuntime: CoworkEngineRuntime | null = null;

  const getCoworkEngineRuntime = (): CoworkEngineRuntime => {
    if (!coworkEngineRuntime) {
      coworkEngineRuntime = createCoworkEngineRuntime({
        getWindows: deps.getWindows,
        getStore: deps.getStore,
        getCoworkStore: deps.getCoworkStore,
        getSkillManager: deps.getSkillManager,
        getIMGatewayManager: deps.getIMGatewayManager,
        getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
        resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
        getCoworkRuntimeForwarder: deps.getCoworkRuntimeForwarder,
        getOpenClawRuntimeAdapter: deps.peekOpenClawRuntimeAdapter,
        getCronJobService,
        startMcpBridge: () => deps.getMcpBridgeRuntime().startBridge(),
        getMcpBridgeConfig: () => deps.getMcpBridgeRuntime().getBridgeConfig(),
        ensureDefaultIdentity,
      });
    }
    return coworkEngineRuntime;
  };
  return createMainRuntimeRegistryCoworkEngineRuntimeView(
    getCoworkEngineRuntime,
    () => coworkEngineRuntime,
  );
}
