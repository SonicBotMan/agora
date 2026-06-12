import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainRuntimeRegistryCoworkEngineRuntimeSupport', () => ({
  createMainRuntimeRegistryCoworkEngineRuntimeSupport: vi.fn(),
}));

vi.mock('./mainRuntimeRegistryCoworkAgentRuntimeSupport', () => ({
  createMainRuntimeRegistryCoworkAgentRuntimeSupport: vi.fn(),
}));

vi.mock('./mainRuntimeRegistryCoworkRouterRuntimeSupport', () => ({
  createMainRuntimeRegistryCoworkRouterRuntimeSupport: vi.fn(),
}));

import { createMainRuntimeRegistryCoworkAgentRuntimeSupport } from './mainRuntimeRegistryCoworkAgentRuntimeSupport';
import { createMainRuntimeRegistryCoworkEngineRuntimeSupport } from './mainRuntimeRegistryCoworkEngineRuntimeSupport';
import { createMainRuntimeRegistryCoworkRouterRuntimeSupport } from './mainRuntimeRegistryCoworkRouterRuntimeSupport';
import { createMainRuntimeRegistryCoworkRuntimeCompose } from './mainRuntimeRegistryCoworkRuntimeComposeSupport';

describe('mainRuntimeRegistryCoworkRuntimeComposeSupport', () => {
  it('composes engine, agent, and router supports with lazy circular dependencies wired correctly', () => {
    let capturedEngineDeps: Record<string, unknown> | null = null;
    let capturedAgentDeps: Record<string, unknown> | null = null;
    let capturedRouterDeps: Record<string, unknown> | null = null;

    const engineSupport = {
      engineKey: 'engine',
      getHermesEngineManager: vi.fn().mockReturnValue('hermes-manager'),
      getOpenClawEngineManager: vi.fn().mockReturnValue('openclaw-manager'),
      getHermesConfigSync: vi.fn().mockReturnValue('hermes-config-sync'),
      ensureOpenClawRunningForCowork: vi.fn(),
      ensureHermesRunningForCowork: vi.fn(),
    };
    const agentSupport = {
      agentKey: 'agent',
      resolveCoworkAgentEngine: vi.fn().mockReturnValue('openclaw'),
    };
    const routerSupport = {
      routerKey: 'router',
      peekOpenClawRuntimeAdapter: vi.fn().mockReturnValue('openclaw-adapter'),
    };

    vi.mocked(createMainRuntimeRegistryCoworkEngineRuntimeSupport)
      .mockImplementation((deps) => {
        capturedEngineDeps = deps as never;
        return engineSupport as never;
      });
    vi.mocked(createMainRuntimeRegistryCoworkAgentRuntimeSupport)
      .mockImplementation((deps) => {
        capturedAgentDeps = deps as never;
        return agentSupport as never;
      });
    vi.mocked(createMainRuntimeRegistryCoworkRouterRuntimeSupport)
      .mockImplementation((deps) => {
        capturedRouterDeps = deps as never;
        return routerSupport as never;
      });

    const deps = {
      getWindows: vi.fn().mockReturnValue([]),
      getStore: vi.fn(),
      getMcpBridgeRuntime: vi.fn(),
      getCoworkStore: vi.fn(),
      getCoworkRuntimeForwarder: vi.fn(),
      getExternalAgentProviderStore: vi.fn(),
      getRuntimeTelemetryTracker: vi.fn(),
      getExternalAgentCliInstaller: vi.fn(),
      getDeepSeekTuiRuntimeManager: vi.fn(),
      getSkillManager: vi.fn(),
      getIMGatewayManager: vi.fn().mockReturnValue('im-gateway-manager'),
      getFeishuRuntimeOwnership: vi.fn().mockReturnValue('owned'),
      resolveFeishuIMAgentEngine: vi.fn().mockReturnValue('hermes'),
    };

    const result = createMainRuntimeRegistryCoworkRuntimeCompose(
      deps as never,
    );

    expect(capturedEngineDeps).toMatchObject({
      getWindows: deps.getWindows,
      getStore: deps.getStore,
      getMcpBridgeRuntime: deps.getMcpBridgeRuntime,
      getCoworkStore: deps.getCoworkStore,
      getCoworkRuntimeForwarder: deps.getCoworkRuntimeForwarder,
      getSkillManager: deps.getSkillManager,
      getIMGatewayManager: deps.getIMGatewayManager,
      getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
      resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    });
    expect(
      (
        capturedEngineDeps?.peekOpenClawRuntimeAdapter as
          | (() => unknown)
          | undefined
      )?.(),
    ).toBe('openclaw-adapter');

    expect(capturedAgentDeps).toMatchObject({
      getWindows: deps.getWindows,
      getCoworkStore: deps.getCoworkStore,
      getExternalAgentCliInstaller: deps.getExternalAgentCliInstaller,
      getHermesEngineManager: engineSupport.getHermesEngineManager,
      getHermesConfigSync: engineSupport.getHermesConfigSync,
      ensureOpenClawRunningForCowork:
        engineSupport.ensureOpenClawRunningForCowork,
      ensureHermesRunningForCowork:
        engineSupport.ensureHermesRunningForCowork,
    });

    expect(capturedRouterDeps).toMatchObject({
      getCoworkStore: deps.getCoworkStore,
      getMcpBridgeRuntime: deps.getMcpBridgeRuntime,
      getExternalAgentProviderStore: deps.getExternalAgentProviderStore,
      getRuntimeTelemetryTracker: deps.getRuntimeTelemetryTracker,
      getDeepSeekTuiRuntimeManager: deps.getDeepSeekTuiRuntimeManager,
      getOpenClawEngineManager: engineSupport.getOpenClawEngineManager,
      getHermesEngineManager: engineSupport.getHermesEngineManager,
      ensureHermesRunningForCowork:
        engineSupport.ensureHermesRunningForCowork,
      resolveCoworkAgentEngine: agentSupport.resolveCoworkAgentEngine,
      getIMGatewayManager: deps.getIMGatewayManager,
    });

    expect(result).toMatchObject({
      engineKey: 'engine',
      agentKey: 'agent',
      routerKey: 'router',
    });
  });
});
