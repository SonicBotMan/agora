import {
  createMainRuntimeRegistryCoworkAgentRuntimeSupport,
} from './mainRuntimeRegistryCoworkAgentRuntimeSupport';
import {
  createMainRuntimeRegistryCoworkEngineRuntimeSupport,
} from './mainRuntimeRegistryCoworkEngineRuntimeSupport';
import {
  createMainRuntimeRegistryCoworkRouterRuntimeSupport,
  type MainRuntimeRegistryCoworkRouterRuntimeSupport,
} from './mainRuntimeRegistryCoworkRouterRuntimeSupport';
import type {
  MainRuntimeRegistryCoworkRuntimeSupport,
  MainRuntimeRegistryCoworkRuntimeSupportDeps,
} from './mainRuntimeRegistryCoworkRuntimeContract';

export function createMainRuntimeRegistryCoworkRuntimeCompose(
  deps: MainRuntimeRegistryCoworkRuntimeSupportDeps,
): MainRuntimeRegistryCoworkRuntimeSupport {
  let routerSupport!: MainRuntimeRegistryCoworkRouterRuntimeSupport;

  const engineSupport = createMainRuntimeRegistryCoworkEngineRuntimeSupport({
    getWindows: deps.getWindows,
    getStore: deps.getStore,
    getMcpBridgeRuntime: deps.getMcpBridgeRuntime,
    getCoworkStore: deps.getCoworkStore,
    getCoworkRuntimeForwarder: deps.getCoworkRuntimeForwarder,
    getSkillManager: deps.getSkillManager,
    getIMGatewayManager: deps.getIMGatewayManager,
    getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
    resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    peekOpenClawRuntimeAdapter: () => routerSupport.peekOpenClawRuntimeAdapter(),
  });

  const agentSupport = createMainRuntimeRegistryCoworkAgentRuntimeSupport({
    getWindows: deps.getWindows,
    getCoworkStore: deps.getCoworkStore,
    getExternalAgentCliInstaller: deps.getExternalAgentCliInstaller,
    getHermesEngineManager: engineSupport.getHermesEngineManager,
    getHermesConfigSync: engineSupport.getHermesConfigSync,
    ensureOpenClawRunningForCowork:
      engineSupport.ensureOpenClawRunningForCowork,
    ensureHermesRunningForCowork: engineSupport.ensureHermesRunningForCowork,
  });

  routerSupport = createMainRuntimeRegistryCoworkRouterRuntimeSupport({
    getCoworkStore: deps.getCoworkStore,
    getMcpBridgeRuntime: deps.getMcpBridgeRuntime,
    getExternalAgentProviderStore: deps.getExternalAgentProviderStore,
    getRuntimeTelemetryTracker: deps.getRuntimeTelemetryTracker,
    getDeepSeekTuiRuntimeManager: deps.getDeepSeekTuiRuntimeManager,
    getOpenClawEngineManager: engineSupport.getOpenClawEngineManager,
    getHermesEngineManager: engineSupport.getHermesEngineManager,
    ensureHermesRunningForCowork: engineSupport.ensureHermesRunningForCowork,
    resolveCoworkAgentEngine: agentSupport.resolveCoworkAgentEngine,
    getIMGatewayManager: deps.getIMGatewayManager,
  });

  return {
    ...routerSupport,
    ...engineSupport,
    ...agentSupport,
  };
}
