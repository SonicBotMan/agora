import { getServerApiBaseUrl } from './libs/endpoints';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { MainIpcRuntimeServiceBuilderDeps } from './mainIpcRuntimeContract';

export function createMainIpcRuntimeServiceBuilderDeps(
  deps: MainBootstrapWiringDeps,
): MainIpcRuntimeServiceBuilderDeps {
  const { runtime } = deps;

  return {
    getCoworkStore: runtime.getCoworkStore,
    getExternalAgentCliInstaller: runtime.getExternalAgentCliInstaller,
    bindExternalAgentCliInstallerForwarder:
      runtime.bindExternalAgentCliInstallerForwarder,
    getOpenClawEngineManager: runtime.getOpenClawEngineManager,
    getHermesEngineManager: runtime.getHermesEngineManager,
    getHermesConfigSync: runtime.getHermesConfigSync,
    bootstrapHermesEngine: runtime.bootstrapHermesEngine,
    getAgentManager: runtime.getAgentManager,
    syncOpenClawConfig: runtime.syncOpenClawConfig,
    getIMGatewayManager: runtime.getIMGatewayManager,
    getMcpStore: () => runtime.getMcpBridgeRuntime().getMcpStore(),
    refreshMcpBridge: () => runtime.getMcpBridgeRuntime().refreshBridge(),
    getServerApiBaseUrl,
    getStore: runtime.getStore,
    getKnowledgeStore: runtime.getKnowledgeStore,
    getKnowledgeSearchEngine: runtime.getKnowledgeSearchEngine,
    getResearchSession: runtime.getResearchSession,
    getTopicMonitor: runtime.getTopicMonitor,
    getFrontendStationRuntime: runtime.getFrontendStationRuntime,
  };
}
