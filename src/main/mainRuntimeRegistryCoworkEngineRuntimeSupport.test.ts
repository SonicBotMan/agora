import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainRuntimeRegistryCoworkEngineRuntimeSupportTestState = vi.hoisted(() => {
  const createCoworkEngineRuntime = vi.fn();
  const getCronJobService = vi.fn();
  const ensureDefaultIdentity = vi.fn();

  return {
    createCoworkEngineRuntime,
    getCronJobService,
    ensureDefaultIdentity,
  };
});

vi.mock('./coworkEngineRuntime', () => ({
  createCoworkEngineRuntime:
    mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.createCoworkEngineRuntime,
}));

vi.mock('./ipcHandlers/scheduledTask', () => ({
  getCronJobService:
    mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.getCronJobService,
}));

vi.mock('./libs/openclawMemoryFile', () => ({
  ensureDefaultIdentity:
    mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.ensureDefaultIdentity,
}));

import { createMainRuntimeRegistryCoworkEngineRuntimeSupport } from './mainRuntimeRegistryCoworkEngineRuntimeSupport';

describe('mainRuntimeRegistryCoworkEngineRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates cowork engine runtime and wires bridge helpers, cron service, and identity bootstrap', async () => {
    const deps = {
      getWindows: vi.fn().mockReturnValue([]),
      getStore: vi.fn(),
      getMcpBridgeRuntime: vi.fn().mockReturnValue({
        startBridge: vi.fn().mockResolvedValue('bridge-config'),
        getBridgeConfig: vi.fn().mockReturnValue('bridge-config-snapshot'),
      }),
      getCoworkStore: vi.fn(),
      getCoworkRuntimeForwarder: vi.fn(),
      getSkillManager: vi.fn(),
      getIMGatewayManager: vi.fn(),
      getFeishuRuntimeOwnership: vi.fn(),
      resolveFeishuIMAgentEngine: vi.fn(),
      peekOpenClawRuntimeAdapter: vi.fn().mockReturnValue('openclaw-adapter'),
    };
    const runtime = {
      peekOpenClawEngineManager: vi.fn().mockReturnValue('openclaw-manager'),
      peekHermesEngineManager: vi.fn().mockReturnValue('hermes-manager'),
      getPendingTokenRefresh: vi.fn().mockReturnValue(null),
      setPendingTokenRefresh: vi.fn(),
      getOpenClawEngineManager: vi.fn().mockReturnValue('openclaw-manager'),
      getHermesEngineManager: vi.fn().mockReturnValue('hermes-manager'),
      bindOpenClawStatusForwarder: vi.fn(),
      bindHermesStatusForwarder: vi.fn(),
      getHermesConfigSync: vi.fn().mockReturnValue('hermes-config-sync'),
      bootstrapHermesEngine: vi.fn().mockResolvedValue('bootstrapped'),
      ensureOpenClawRunningForCowork: vi.fn().mockResolvedValue('openclaw-ready'),
      ensureHermesRunningForCowork: vi.fn().mockResolvedValue('hermes-ready'),
      detectLocalOpenClawFeishu: vi.fn().mockReturnValue({ configured: true }),
      hasLocalOpenClawFeishuConfigured: vi.fn().mockReturnValue(true),
      syncHermesIMSessionsToCowork: vi.fn().mockResolvedValue(undefined),
      startHermesIMSessionSyncPolling: vi.fn(),
      stopHermesIMSessionSyncPolling: vi.fn(),
      getOpenClawConfigSync: vi.fn().mockReturnValue('openclaw-config-sync'),
      syncOpenClawConfig: vi.fn().mockResolvedValue({
        success: true,
        changed: false,
      }),
    };
    let capturedDeps: Record<string, unknown> | null = null;

    mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.getCronJobService
      .mockReturnValue('cron-service');
    mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.createCoworkEngineRuntime
      .mockImplementation((input) => {
        capturedDeps = input as never;
        return runtime as never;
      });

    const support = createMainRuntimeRegistryCoworkEngineRuntimeSupport(
      deps as never,
    );

    expect(support.peekOpenClawEngineManager()).toBeNull();
    expect(support.peekHermesEngineManager()).toBeNull();
    expect(support.getOpenClawEngineManager()).toBe('openclaw-manager');
    expect(support.getHermesEngineManager()).toBe('hermes-manager');
    await expect(support.ensureOpenClawRunningForCowork()).resolves.toBe(
      'openclaw-ready',
    );
    await expect(support.bootstrapHermesEngine()).resolves.toBe('bootstrapped');

    expect(
      mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.createCoworkEngineRuntime,
    ).toHaveBeenCalledTimes(1);
    expect(capturedDeps).toMatchObject({
      getWindows: deps.getWindows,
      getStore: deps.getStore,
      getCoworkStore: deps.getCoworkStore,
      getSkillManager: deps.getSkillManager,
      getIMGatewayManager: deps.getIMGatewayManager,
      getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
      resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
      getCoworkRuntimeForwarder: deps.getCoworkRuntimeForwarder,
      getOpenClawRuntimeAdapter: deps.peekOpenClawRuntimeAdapter,
      ensureDefaultIdentity:
        mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.ensureDefaultIdentity,
    });
    expect(capturedDeps?.getCronJobService).toBe(
      mainRuntimeRegistryCoworkEngineRuntimeSupportTestState.getCronJobService,
    );
    await expect(
      (
        capturedDeps?.startMcpBridge as (() => Promise<unknown>) | undefined
      )?.(),
    ).resolves.toBe('bridge-config');
    expect(
      (
        capturedDeps?.getMcpBridgeConfig as (() => unknown) | undefined
      )?.(),
    ).toBe('bridge-config-snapshot');
  });
});
