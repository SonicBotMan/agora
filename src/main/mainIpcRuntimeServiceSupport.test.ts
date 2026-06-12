import { describe, expect, it, vi } from 'vitest';

import { createMainIpcRuntimeServiceHandlerDeps } from './mainIpcRuntimeServiceSupport';

function createDeps() {
  return {
    getCoworkStore: vi.fn(),
    getExternalAgentCliInstaller: vi.fn(),
    bindExternalAgentCliInstallerForwarder: vi.fn(),
    getOpenClawEngineManager: vi.fn(),
    getHermesEngineManager: vi.fn(),
    getHermesConfigSync: vi.fn(),
    bootstrapHermesEngine: vi.fn(),
    getAgentManager: vi.fn(),
    syncOpenClawConfig: vi.fn(),
    getIMGatewayManager: vi.fn(),
    getMcpStore: vi.fn(),
    refreshMcpBridge: vi.fn(),
    getServerApiBaseUrl: vi.fn(),
    getStore: vi.fn().mockReturnValue({ id: 'store' }),
    getKnowledgeStore: vi.fn(),
    getKnowledgeSearchEngine: vi.fn(),
    getResearchSession: vi.fn(),
    getTopicMonitor: vi.fn(),
    getFrontendStationRuntime: vi.fn(),
  };
}

describe('mainIpcRuntimeServiceSupport', () => {
  it('builds service handler groups with the expected runtime wiring', () => {
    const deps = createDeps();
    const handlerDeps = createMainIpcRuntimeServiceHandlerDeps(deps as never);

    expect(handlerDeps.engines.getOpenClawEngineManager).toBe(
      deps.getOpenClawEngineManager,
    );
    expect(handlerDeps.engines.getHermesEngineManager).toBe(
      deps.getHermesEngineManager,
    );
    expect(handlerDeps.engines.getCoworkStore).toBe(deps.getCoworkStore);
    expect(handlerDeps.engines.getExternalAgentCliInstaller).toBe(
      deps.getExternalAgentCliInstaller,
    );
    expect(handlerDeps.engines.bindExternalAgentCliInstallerForwarder).toBe(
      deps.bindExternalAgentCliInstallerForwarder,
    );
    expect(handlerDeps.engines.getHermesConfigSync).toBe(
      deps.getHermesConfigSync,
    );
    expect(handlerDeps.engines.bootstrapHermesEngine).toBe(
      deps.bootstrapHermesEngine,
    );

    expect(handlerDeps.agents.getAgentManager).toBe(deps.getAgentManager);
    expect(handlerDeps.agents.syncOpenClawConfig).toBe(deps.syncOpenClawConfig);
    expect(handlerDeps.agents.getIMGatewayManager).toBe(
      deps.getIMGatewayManager,
    );

    expect(handlerDeps.mcp.getMcpStore).toBe(deps.getMcpStore);
    expect(handlerDeps.mcp.refreshMcpBridge).toBe(deps.refreshMcpBridge);
    expect(handlerDeps.mcp.getServerApiBaseUrl).toBe(
      deps.getServerApiBaseUrl,
    );

    expect(handlerDeps.api.getStore()).toEqual({ id: 'store' });
    expect(handlerDeps.api.getCoworkStore).toBe(deps.getCoworkStore);
    expect(handlerDeps.api.getHermesConfigSync).toBe(deps.getHermesConfigSync);
    expect(handlerDeps.api.getHermesEngineManager).toBe(
      deps.getHermesEngineManager,
    );
    expect(handlerDeps.research.getResearchSession).toBe(
      deps.getResearchSession,
    );
    expect(handlerDeps.knowledge.getKnowledgeStore).toBe(
      deps.getKnowledgeStore,
    );
    expect(handlerDeps.knowledge.getKnowledgeSearchEngine).toBe(
      deps.getKnowledgeSearchEngine,
    );
    expect(handlerDeps.hotTopics.getTopicMonitor).toBe(
      deps.getTopicMonitor,
    );
    expect(handlerDeps.frontendStation.getFrontendStationRuntime).toBe(
      deps.getFrontendStationRuntime,
    );
  });
});
