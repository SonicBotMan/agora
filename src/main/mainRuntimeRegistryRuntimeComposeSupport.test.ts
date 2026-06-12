import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainRuntimeRegistryCoworkRuntimeSupport', () => ({
  createMainRuntimeRegistryCoworkRuntimeSupport: vi.fn(),
}));

vi.mock('./mainRuntimeRegistryIMRuntimeSupport', () => ({
  createMainRuntimeRegistryIMRuntimeSupport: vi.fn(),
}));

import { createMainRuntimeRegistryCoworkRuntimeSupport } from './mainRuntimeRegistryCoworkRuntimeSupport';
import { createMainRuntimeRegistryIMRuntimeSupport } from './mainRuntimeRegistryIMRuntimeSupport';
import { createMainRuntimeRegistryRuntimeCompose } from './mainRuntimeRegistryRuntimeComposeSupport';

describe('mainRuntimeRegistryRuntimeComposeSupport', () => {
  it('wires cowork runtime dependencies to IM runtime lazily and merges both supports', () => {
    let capturedCoworkDeps: Record<string, unknown> | null = null;
    let capturedImDeps: Record<string, unknown> | null = null;

    const coworkSupport = {
      coworkKey: 'cowork',
      getCoworkEngineRouter: vi.fn().mockReturnValue('router'),
      getAgentTeamRunner: vi.fn().mockReturnValue('agent-team-runner'),
      resolveCoworkAgentEngine: vi.fn().mockReturnValue('openclaw'),
      ensureOpenClawRunningForCowork: vi.fn(),
      ensureHermesRunningForCowork: vi.fn(),
      detectLocalOpenClawFeishu: vi.fn(),
      hasLocalOpenClawFeishuConfigured: vi.fn(),
      syncOpenClawConfig: vi.fn(),
      getHermesConfigSync: vi.fn(),
      peekOpenClawRuntimeAdapter: vi.fn(),
      startHermesIMSessionSyncPolling: vi.fn(),
      syncHermesIMSessionsToCowork: vi.fn(),
    };

    const imGatewayManager = { id: 'im-gateway-manager' };
    const imSupport = {
      imKey: 'im',
      getIMGatewayManager: vi.fn().mockReturnValue(imGatewayManager),
      getFeishuRuntimeOwnership: vi.fn().mockReturnValue('owned'),
      resolveFeishuIMAgentEngine: vi.fn().mockReturnValue('hermes'),
      peekIMGatewayManager: vi.fn(),
      getScheduledTaskIMGatewayManager: vi.fn(),
      normalizeFeishuEngineKey: vi.fn(),
      isFeishuEngineManagedByAgora: vi.fn(),
    };

    vi.mocked(createMainRuntimeRegistryCoworkRuntimeSupport).mockImplementation(
      (deps) => {
        capturedCoworkDeps = deps as never;
        return coworkSupport as never;
      },
    );
    vi.mocked(createMainRuntimeRegistryIMRuntimeSupport).mockImplementation(
      (deps) => {
        capturedImDeps = deps as never;
        return imSupport as never;
      },
    );

    const support = {
      getStore: vi.fn(),
      getCoworkStore: vi.fn(),
      getSkillManager: vi.fn(),
      getWindows: vi.fn(),
      getMcpBridgeRuntime: vi.fn(),
      getCoworkRuntimeForwarder: vi.fn(),
      getExternalAgentProviderStore: vi.fn(),
      getRuntimeTelemetryTracker: vi.fn(),
      getExternalAgentCliInstaller: vi.fn(),
      getDeepSeekTuiRuntimeManager: vi.fn(),
    };

    const result = createMainRuntimeRegistryRuntimeCompose({
      getWindows: vi.fn().mockReturnValue([]),
      support: support as never,
    });

    expect(capturedImDeps?.getCoworkEngineRouter).toBe(
      coworkSupport.getCoworkEngineRouter,
    );
    expect(capturedImDeps?.getAgentTeamRunner).toBe(
      coworkSupport.getAgentTeamRunner,
    );
    expect(capturedCoworkDeps?.getIMGatewayManager()).toBe(imGatewayManager);
    expect(capturedCoworkDeps?.getFeishuRuntimeOwnership('feishu')).toBe(
      'owned',
    );
    expect(capturedCoworkDeps?.resolveFeishuIMAgentEngine()).toBe('hermes');
    expect(result).toMatchObject({
      coworkKey: 'cowork',
      imKey: 'im',
    });
  });
});
