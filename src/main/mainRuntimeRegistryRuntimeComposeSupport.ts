import {
  createMainRuntimeRegistryCoworkRuntimeSupport,
} from './mainRuntimeRegistryCoworkRuntimeSupport';
import {
  createMainRuntimeRegistryIMRuntimeSupport,
  type MainRuntimeRegistryIMRuntimeSupport,
} from './mainRuntimeRegistryIMRuntimeSupport';
import type {
  MainRuntimeRegistryRuntimeSupport,
  MainRuntimeRegistryRuntimeSupportDeps,
} from './mainRuntimeRegistryRuntimeContract';

export function createMainRuntimeRegistryRuntimeCompose(
  deps: MainRuntimeRegistryRuntimeSupportDeps,
): MainRuntimeRegistryRuntimeSupport {
  let imSupport!: MainRuntimeRegistryIMRuntimeSupport;

  const coworkSupport = createMainRuntimeRegistryCoworkRuntimeSupport({
    getWindows: deps.getWindows,
    getStore: deps.support.getStore,
    getMcpBridgeRuntime: deps.support.getMcpBridgeRuntime,
    getCoworkStore: deps.support.getCoworkStore,
    getCoworkRuntimeForwarder: deps.support.getCoworkRuntimeForwarder,
    getExternalAgentProviderStore:
      deps.support.getExternalAgentProviderStore,
    getRuntimeTelemetryTracker: deps.support.getRuntimeTelemetryTracker,
    getExternalAgentCliInstaller: deps.support.getExternalAgentCliInstaller,
    getDeepSeekTuiRuntimeManager: deps.support.getDeepSeekTuiRuntimeManager,
    getSkillManager: deps.support.getSkillManager,
    getIMGatewayManager: () => imSupport.getIMGatewayManager(),
    getFeishuRuntimeOwnership: (engineKey) =>
      imSupport.getFeishuRuntimeOwnership(engineKey),
    resolveFeishuIMAgentEngine: () => imSupport.resolveFeishuIMAgentEngine(),
  });

  imSupport = createMainRuntimeRegistryIMRuntimeSupport({
    getWindows: deps.getWindows,
    getStore: deps.support.getStore,
    getCoworkStore: deps.support.getCoworkStore,
    getSkillManager: deps.support.getSkillManager,
    getCoworkEngineRouter: coworkSupport.getCoworkEngineRouter,
    getAgentTeamRunner: coworkSupport.getAgentTeamRunner,
    resolveCoworkAgentEngine: coworkSupport.resolveCoworkAgentEngine,
    ensureOpenClawRunningForCowork:
      coworkSupport.ensureOpenClawRunningForCowork,
    ensureHermesRunningForCowork: coworkSupport.ensureHermesRunningForCowork,
    detectLocalOpenClawFeishu: coworkSupport.detectLocalOpenClawFeishu,
    hasLocalOpenClawFeishuConfigured:
      coworkSupport.hasLocalOpenClawFeishuConfigured,
    syncOpenClawConfig: coworkSupport.syncOpenClawConfig,
    getHermesConfigSync: coworkSupport.getHermesConfigSync,
    peekOpenClawRuntimeAdapter: coworkSupport.peekOpenClawRuntimeAdapter,
    startHermesIMSessionSyncPolling:
      coworkSupport.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: coworkSupport.syncHermesIMSessionsToCowork,
  });

  return {
    ...coworkSupport,
    ...imSupport,
  };
}
