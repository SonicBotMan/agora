import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainRuntimeRegistryIMRuntimeSupportTestState = vi.hoisted(() => {
  const createIMGatewayRuntime = vi.fn();
  const getCronJobService = vi.fn();
  const getFeishuRuntimeOwnershipStatus = vi.fn();
  const createScheduledTaskIMGatewayManagerView = vi.fn();

  return {
    createIMGatewayRuntime,
    getCronJobService,
    getFeishuRuntimeOwnershipStatus,
    createScheduledTaskIMGatewayManagerView,
  };
});

vi.mock('./imGatewayRuntime', () => ({
  createIMGatewayRuntime:
    mainRuntimeRegistryIMRuntimeSupportTestState.createIMGatewayRuntime,
}));

vi.mock('./ipcHandlers/scheduledTask', () => ({
  getCronJobService:
    mainRuntimeRegistryIMRuntimeSupportTestState.getCronJobService,
}));

vi.mock('./libs/feishuLocalRuntimeManager', () => ({
  getFeishuRuntimeOwnershipStatus:
    mainRuntimeRegistryIMRuntimeSupportTestState.getFeishuRuntimeOwnershipStatus,
}));

vi.mock('./mainRuntimeRegistrySupport', () => ({
  createScheduledTaskIMGatewayManagerView:
    mainRuntimeRegistryIMRuntimeSupportTestState.createScheduledTaskIMGatewayManagerView,
}));

import { createMainRuntimeRegistryIMRuntimeSupport } from './mainRuntimeRegistryIMRuntimeSupport';

function createDeps() {
  return {
    getWindows: vi.fn().mockReturnValue([]),
    getStore: vi.fn(),
    getCoworkStore: vi.fn(),
    getSkillManager: vi.fn(),
    getCoworkEngineRouter: vi.fn(),
    getAgentTeamRunner: vi.fn(),
    resolveCoworkAgentEngine: vi.fn(),
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
}

describe('mainRuntimeRegistryIMRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates IM gateway runtime and forwards its helpers plus scheduled-task view wiring', () => {
    const deps = createDeps();
    const manager = { id: 'im-gateway-manager' };
    const scheduledTaskView = { id: 'scheduled-task-view' };
    const runtime = {
      peekIMGatewayManager: vi.fn().mockReturnValue(manager),
      getIMGatewayManager: vi.fn().mockReturnValue(manager),
      resolveFeishuIMAgentEngine: vi.fn().mockReturnValue('hermes'),
      normalizeFeishuEngineKey: vi.fn().mockReturnValue('codex'),
      getFeishuRuntimeOwnership: vi.fn().mockReturnValue('owned'),
      isFeishuEngineManagedByAgora: vi.fn().mockReturnValue(true),
    };
    let capturedDeps: Record<string, unknown> | null = null;

    mainRuntimeRegistryIMRuntimeSupportTestState.getCronJobService
      .mockReturnValue('cron-service');
    mainRuntimeRegistryIMRuntimeSupportTestState.createScheduledTaskIMGatewayManagerView
      .mockReturnValue(scheduledTaskView);
    mainRuntimeRegistryIMRuntimeSupportTestState.createIMGatewayRuntime
      .mockImplementation((input) => {
        capturedDeps = input as never;
        return runtime as never;
      });

    const support = createMainRuntimeRegistryIMRuntimeSupport(deps as never);

    expect(support.peekIMGatewayManager()).toBeNull();
    expect(support.resolveFeishuIMAgentEngine()).toBe('hermes');
    expect(support.normalizeFeishuEngineKey('anything')).toBe('codex');
    expect(support.getFeishuRuntimeOwnership('hermes')).toBe('owned');
    expect(support.isFeishuEngineManagedByAgora('codex')).toBe(true);
    expect(mainRuntimeRegistryIMRuntimeSupportTestState.createIMGatewayRuntime)
      .toHaveBeenCalledTimes(1);

    expect(capturedDeps).toMatchObject({
      getWindows: deps.getWindows,
      getStore: deps.getStore,
      getCoworkStore: deps.getCoworkStore,
      getSkillManager: deps.getSkillManager,
      getCoworkEngineRouter: deps.getCoworkEngineRouter,
      getAgentTeamRunner: deps.getAgentTeamRunner,
      resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
      ensureOpenClawRunningForCowork: deps.ensureOpenClawRunningForCowork,
      ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
      detectLocalOpenClawFeishu: deps.detectLocalOpenClawFeishu,
      hasLocalOpenClawFeishuConfigured: deps.hasLocalOpenClawFeishuConfigured,
      syncOpenClawConfig: deps.syncOpenClawConfig,
      getHermesConfigSync: deps.getHermesConfigSync,
      peekOpenClawRuntimeAdapter: deps.peekOpenClawRuntimeAdapter,
      startHermesIMSessionSyncPolling: deps.startHermesIMSessionSyncPolling,
      syncHermesIMSessionsToCowork: deps.syncHermesIMSessionsToCowork,
    });
    expect(capturedDeps?.getCronJobService).toBe(
      mainRuntimeRegistryIMRuntimeSupportTestState.getCronJobService,
    );
    expect(capturedDeps?.getFeishuRuntimeOwnershipStatus).toBe(
      mainRuntimeRegistryIMRuntimeSupportTestState.getFeishuRuntimeOwnershipStatus,
    );

    expect(support.getIMGatewayManager()).toBe(manager);
    expect(support.peekIMGatewayManager()).toBe(manager);
    expect(support.getScheduledTaskIMGatewayManager()).toBe(scheduledTaskView);
    expect(
      mainRuntimeRegistryIMRuntimeSupportTestState.createScheduledTaskIMGatewayManagerView,
    ).toHaveBeenCalledWith(manager);
  });
});
