import { describe, expect, it, vi } from 'vitest';

vi.mock('./libs/endpoints', () => ({
  getServerApiBaseUrl: vi.fn(),
}));

import { getServerApiBaseUrl } from './libs/endpoints';
import { createMainIpcRuntimeServiceBuilderDeps } from './mainBootstrapIpcRuntimeServiceSupport';

describe('mainBootstrapIpcRuntimeServiceSupport', () => {
  it('maps service runtime dependencies and lazily resolves MCP bridge helpers', () => {
    const mcpStore = { id: 'mcp-store' };
    const mcpBridgeRuntime = {
      getMcpStore: vi.fn().mockReturnValue(mcpStore),
      refreshBridge: vi.fn(),
    };
    const runtime = {
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
      getMcpBridgeRuntime: vi.fn().mockReturnValue(mcpBridgeRuntime),
      getStore: vi.fn(),
      getKnowledgeStore: vi.fn(),
      getKnowledgeSearchEngine: vi.fn(),
      getResearchSession: vi.fn(),
      getTopicMonitor: vi.fn(),
      getFrontendStationRuntime: vi.fn(),
    };

    const deps = createMainIpcRuntimeServiceBuilderDeps({ runtime } as never);

    expect(deps.getCoworkStore).toBe(runtime.getCoworkStore);
    expect(deps.getExternalAgentCliInstaller).toBe(
      runtime.getExternalAgentCliInstaller,
    );
    expect(deps.bindExternalAgentCliInstallerForwarder).toBe(
      runtime.bindExternalAgentCliInstallerForwarder,
    );
    expect(deps.getOpenClawEngineManager).toBe(runtime.getOpenClawEngineManager);
    expect(deps.getHermesEngineManager).toBe(runtime.getHermesEngineManager);
    expect(deps.getHermesConfigSync).toBe(runtime.getHermesConfigSync);
    expect(deps.bootstrapHermesEngine).toBe(runtime.bootstrapHermesEngine);
    expect(deps.getAgentManager).toBe(runtime.getAgentManager);
    expect(deps.syncOpenClawConfig).toBe(runtime.syncOpenClawConfig);
    expect(deps.getIMGatewayManager).toBe(runtime.getIMGatewayManager);
    expect(deps.getStore).toBe(runtime.getStore);
    expect(deps.getKnowledgeStore).toBe(runtime.getKnowledgeStore);
    expect(deps.getKnowledgeSearchEngine).toBe(
      runtime.getKnowledgeSearchEngine,
    );
    expect(deps.getResearchSession).toBe(runtime.getResearchSession);
    expect(deps.getTopicMonitor).toBe(runtime.getTopicMonitor);
    expect(deps.getFrontendStationRuntime).toBe(
      runtime.getFrontendStationRuntime,
    );
    expect(deps.getServerApiBaseUrl).toBe(getServerApiBaseUrl);

    expect(deps.getMcpStore()).toBe(mcpStore);
    expect(runtime.getMcpBridgeRuntime).toHaveBeenCalledTimes(1);
    expect(mcpBridgeRuntime.getMcpStore).toHaveBeenCalledTimes(1);

    deps.refreshMcpBridge();
    expect(runtime.getMcpBridgeRuntime).toHaveBeenCalledTimes(2);
    expect(mcpBridgeRuntime.refreshBridge).toHaveBeenCalledTimes(1);
  });
});
