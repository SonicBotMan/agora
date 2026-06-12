import { createHermesEngineSupport } from './coworkEngineHermesSupport';
import { createOpenClawEngineSupport } from './coworkEngineOpenClawSupport';
import type {
  CoworkEngineRuntime,
  CoworkEngineRuntimeDeps,
} from './coworkEngineRuntimeContract';

export function createCoworkEngineRuntimeCompose(
  deps: CoworkEngineRuntimeDeps,
): CoworkEngineRuntime {
  const openClawSupport = createOpenClawEngineSupport({
    getWindows: deps.getWindows,
    getStore: deps.getStore,
    getCoworkStore: deps.getCoworkStore,
    getSkillManager: deps.getSkillManager,
    getIMGatewayManager: deps.getIMGatewayManager,
    getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
    resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    getOpenClawRuntimeAdapter: deps.getOpenClawRuntimeAdapter,
    getCronJobService: deps.getCronJobService,
    startMcpBridge: deps.startMcpBridge,
    getMcpBridgeConfig: deps.getMcpBridgeConfig,
    ensureDefaultIdentity: deps.ensureDefaultIdentity,
  });

  const hermesSupport = createHermesEngineSupport({
    getWindows: deps.getWindows,
    getCoworkStore: deps.getCoworkStore,
    getIMGatewayManager: deps.getIMGatewayManager,
    getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
    getCoworkRuntimeForwarder: deps.getCoworkRuntimeForwarder,
    resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
  });

  return {
    ...openClawSupport,
    ...hermesSupport,
  };
}
