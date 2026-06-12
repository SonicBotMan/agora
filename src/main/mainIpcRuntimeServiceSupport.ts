import type { AllHandlerDeps } from './ipc';
import type { MainIpcRuntimeServiceBuilderDeps } from './mainIpcRuntimeContract';

type MainIpcRuntimeServiceHandlerDeps = Pick<
  AllHandlerDeps,
  | 'engines'
  | 'agents'
  | 'mcp'
  | 'api'
  | 'research'
  | 'knowledge'
  | 'hotTopics'
  | 'frontendStation'
>;

export function createMainIpcRuntimeServiceHandlerDeps(
  deps: MainIpcRuntimeServiceBuilderDeps,
): MainIpcRuntimeServiceHandlerDeps {
  return {
    engines: {
      getOpenClawEngineManager: deps.getOpenClawEngineManager,
      getHermesEngineManager: deps.getHermesEngineManager,
      getCoworkStore: deps.getCoworkStore,
      getExternalAgentCliInstaller: deps.getExternalAgentCliInstaller,
      bindExternalAgentCliInstallerForwarder:
        deps.bindExternalAgentCliInstallerForwarder,
      getHermesConfigSync: deps.getHermesConfigSync,
      bootstrapHermesEngine: deps.bootstrapHermesEngine,
    },
    agents: {
      getAgentManager: deps.getAgentManager,
      syncOpenClawConfig: deps.syncOpenClawConfig,
      getIMGatewayManager: deps.getIMGatewayManager,
    },
    mcp: {
      getMcpStore: deps.getMcpStore,
      refreshMcpBridge: deps.refreshMcpBridge,
      getServerApiBaseUrl: deps.getServerApiBaseUrl,
    },
    api: {
      getStore: () => deps.getStore(),
      getCoworkStore: deps.getCoworkStore,
      getHermesConfigSync: deps.getHermesConfigSync,
      getHermesEngineManager: deps.getHermesEngineManager,
    },
    research: {
      getResearchSession: deps.getResearchSession,
    },
    knowledge: {
      getKnowledgeStore: deps.getKnowledgeStore,
      getKnowledgeSearchEngine: deps.getKnowledgeSearchEngine,
    },
    hotTopics: {
      getTopicMonitor: deps.getTopicMonitor,
    },
    frontendStation: {
      getFrontendStationRuntime: deps.getFrontendStationRuntime,
    },
  };
}
