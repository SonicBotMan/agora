import { beforeEach, describe, expect, it, vi } from 'vitest';

const imGatewayRuntimeTestState = vi.hoisted(() => {
  const createIMGatewayManager = vi.fn();
  const createIMGatewayFeishuSupport = vi.fn();
  const createIMGatewayScheduledTaskHandler = vi.fn();

  return {
    createIMGatewayManager,
    createIMGatewayFeishuSupport,
    createIMGatewayScheduledTaskHandler,
  };
});

vi.mock('./imGatewayRuntimeSupport', () => ({
  createIMGatewayManager: imGatewayRuntimeTestState.createIMGatewayManager,
  createIMGatewayFeishuSupport:
    imGatewayRuntimeTestState.createIMGatewayFeishuSupport,
  createIMGatewayScheduledTaskHandler:
    imGatewayRuntimeTestState.createIMGatewayScheduledTaskHandler,
}));

import { createIMGatewayRuntime } from './imGatewayRuntime';

function createDeps() {
  return {
    getWindows: vi.fn().mockReturnValue([]),
    getStore: vi.fn(),
    getCoworkStore: vi.fn(),
    getCoworkEngineRouter: vi.fn(),
    getSkillManager: vi.fn(),
    getAgentTeamRunner: vi.fn(),
    getCronJobService: vi.fn().mockReturnValue({ addJob: vi.fn() }),
    resolveCoworkAgentEngine: vi.fn().mockReturnValue('openclaw'),
    ensureOpenClawRunningForCowork: vi.fn(),
    ensureHermesRunningForCowork: vi.fn(),
    getFeishuRuntimeOwnershipStatus: vi.fn(),
    detectLocalOpenClawFeishu: vi.fn(),
    hasLocalOpenClawFeishuConfigured: vi.fn(),
    syncOpenClawConfig: vi.fn(),
    getHermesConfigSync: vi.fn(),
    peekOpenClawRuntimeAdapter: vi.fn(),
    startHermesIMSessionSyncPolling: vi.fn(),
    syncHermesIMSessionsToCowork: vi.fn(),
  };
}

describe('imGatewayRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires feishu support and lazily creates the IM gateway manager with scheduled task support', () => {
    const deps = createDeps();
    const manager = { id: 'im-gateway-manager' };
    const createScheduledTask = vi.fn();
    const feishuSupport = {
      resolveFeishuIMAgentEngine: vi.fn().mockReturnValue('hermes'),
      resolveFeishuEngineKey: vi.fn().mockReturnValue('hermes'),
      normalizeFeishuEngineKey: vi.fn().mockReturnValue('hermes'),
      getFeishuManagementMode: vi.fn().mockReturnValue('agora'),
      getFeishuRuntimeOwnership: vi.fn().mockReturnValue('owned'),
      isFeishuEngineManagedByAgora: vi.fn().mockReturnValue(true),
      ensureCoworkReady: vi.fn(),
    };
    let capturedManagerArgs: Record<string, unknown> | null = null;

    imGatewayRuntimeTestState.createIMGatewayScheduledTaskHandler.mockReturnValue(
      createScheduledTask,
    );
    imGatewayRuntimeTestState.createIMGatewayFeishuSupport.mockReturnValue(
      feishuSupport,
    );
    imGatewayRuntimeTestState.createIMGatewayManager.mockImplementation((args) => {
      capturedManagerArgs = args as never;
      return manager as never;
    });

    const runtime = createIMGatewayRuntime(deps as never);

    expect(runtime.peekIMGatewayManager()).toBeNull();
    expect(imGatewayRuntimeTestState.createIMGatewayScheduledTaskHandler)
      .toHaveBeenCalledWith({
        getCronJobService: deps.getCronJobService,
      });
    expect(imGatewayRuntimeTestState.createIMGatewayFeishuSupport)
      .toHaveBeenCalledWith({
        getIMGatewayManager: expect.any(Function),
        resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
        ensureOpenClawRunningForCowork: deps.ensureOpenClawRunningForCowork,
        ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
      });

    expect(runtime.resolveFeishuIMAgentEngine()).toBe('hermes');
    expect(runtime.normalizeFeishuEngineKey('value')).toBe('hermes');
    expect(runtime.getFeishuManagementMode()).toBe('agora');
    expect(runtime.getFeishuRuntimeOwnership('hermes')).toBe('owned');
    expect(runtime.isFeishuEngineManagedByAgora('hermes')).toBe(true);

    expect(runtime.getIMGatewayManager()).toBe(manager);
    expect(runtime.getIMGatewayManager()).toBe(manager);
    expect(runtime.peekIMGatewayManager()).toBe(manager);
    expect(imGatewayRuntimeTestState.createIMGatewayManager).toHaveBeenCalledTimes(
      1,
    );
    expect(capturedManagerArgs?.deps).toBe(deps);
    expect(capturedManagerArgs?.createScheduledTask).toBe(createScheduledTask);
    expect(capturedManagerArgs?.support).toMatchObject({
      ensureCoworkReady: feishuSupport.ensureCoworkReady,
      resolveFeishuIMAgentEngine: feishuSupport.resolveFeishuIMAgentEngine,
      resolveFeishuEngineKey: feishuSupport.resolveFeishuEngineKey,
      getFeishuManagementMode: feishuSupport.getFeishuManagementMode,
      getFeishuRuntimeOwnership: feishuSupport.getFeishuRuntimeOwnership,
    });

    const feishuDeps =
      imGatewayRuntimeTestState.createIMGatewayFeishuSupport.mock.calls[0]?.[0] as
        | { getIMGatewayManager: () => unknown }
        | undefined;
    expect(feishuDeps?.getIMGatewayManager()).toBe(manager);
  });
});
