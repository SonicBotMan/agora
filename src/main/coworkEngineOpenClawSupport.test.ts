import { beforeEach, describe, expect, it, vi } from 'vitest';

const openClawSupportTestState = vi.hoisted(() => {
  const createOpenClawConfigSupport = vi.fn();
  const createOpenClawEngineLifecycleSupport = vi.fn();
  const managerInstances: Array<{
    listeners: Map<string, Array<(...args: unknown[]) => void>>;
    on: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    emitStatus: (status: unknown) => void;
  }> = [];

  class MockOpenClawEngineManager {
    listeners: Map<string, Array<(...args: unknown[]) => void>>;
    on: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;

    constructor() {
      this.listeners = new Map();
      this.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const current = this.listeners.get(event) ?? [];
        current.push(listener);
        this.listeners.set(event, current);
        return this;
      });
      this.getStatus = vi.fn().mockReturnValue({
        phase: 'ready',
        message: 'ready',
        canRetry: true,
      });
      managerInstances.push(this);
    }

    emitStatus(status: unknown): void {
      for (const listener of this.listeners.get('status') ?? []) {
        listener(status);
      }
    }
  }

  return {
    createOpenClawConfigSupport,
    createOpenClawEngineLifecycleSupport,
    managerInstances,
    MockOpenClawEngineManager,
  };
});

vi.mock('./coworkEngineOpenClawConfigSupport', () => ({
  createOpenClawConfigSupport:
    openClawSupportTestState.createOpenClawConfigSupport,
}));

vi.mock('./coworkEngineOpenClawLifecycleSupport', () => ({
  createOpenClawEngineLifecycleSupport:
    openClawSupportTestState.createOpenClawEngineLifecycleSupport,
}));

vi.mock('./libs/openclawEngineManager', () => ({
  OpenClawEngineManager: openClawSupportTestState.MockOpenClawEngineManager,
}));

import { createOpenClawEngineSupport } from './coworkEngineOpenClawSupport';

function createDeps() {
  return {
    getWindows: vi.fn().mockReturnValue([
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      },
      {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: vi.fn() },
      },
    ]),
    getStore: vi.fn(),
    getCoworkStore: vi.fn(),
    getSkillManager: vi.fn(),
    getIMGatewayManager: vi.fn(),
    getFeishuRuntimeOwnership: vi.fn(),
    resolveFeishuIMAgentEngine: vi.fn(),
    getOpenClawRuntimeAdapter: vi.fn(),
    getCronJobService: vi.fn(),
    startMcpBridge: vi.fn(),
    getMcpBridgeConfig: vi.fn(),
    ensureDefaultIdentity: vi.fn(),
  };
}

describe('coworkEngineOpenClawSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openClawSupportTestState.managerInstances.length = 0;
  });

  it('composes config and lifecycle supports around a lazy OpenClaw engine manager', () => {
    const deps = createDeps();
    const configSupport = {
      getOpenClawConfigSync: vi.fn().mockReturnValue('config-sync'),
      syncOpenClawConfig: vi.fn(),
      detectLocalOpenClawFeishu: vi.fn().mockReturnValue({
        configured: true,
      }),
      hasLocalOpenClawFeishuConfigured: vi.fn().mockReturnValue(true),
    };
    const lifecycleSupport = {
      bootstrapOpenClawEngine: vi.fn(),
      getPendingTokenRefresh: vi.fn().mockReturnValue(null),
      setPendingTokenRefresh: vi.fn(),
      ensureOpenClawRunningForCowork: vi.fn(),
    };
    let capturedConfigDeps: Record<string, unknown> | null = null;
    let capturedLifecycleDeps: Record<string, unknown> | null = null;

    openClawSupportTestState.createOpenClawConfigSupport.mockImplementation(
      (input) => {
        capturedConfigDeps = input as never;
        return configSupport as never;
      },
    );
    openClawSupportTestState.createOpenClawEngineLifecycleSupport.mockImplementation(
      (input) => {
        capturedLifecycleDeps = input as never;
        return lifecycleSupport as never;
      },
    );

    const support = createOpenClawEngineSupport(deps as never);

    expect(support.peekOpenClawEngineManager()).toBeNull();
    expect(support.getOpenClawConfigSync()).toBe('config-sync');
    expect(support.detectLocalOpenClawFeishu()).toEqual({
      configured: true,
    });
    expect(support.hasLocalOpenClawFeishuConfigured()).toBe(true);
    expect(support.bootstrapOpenClawEngine).toBe(
      lifecycleSupport.bootstrapOpenClawEngine,
    );
    expect(support.syncOpenClawConfig).toBe(configSupport.syncOpenClawConfig);
    expect(support.getPendingTokenRefresh).toBe(
      lifecycleSupport.getPendingTokenRefresh,
    );
    expect(support.setPendingTokenRefresh).toBe(
      lifecycleSupport.setPendingTokenRefresh,
    );
    expect(support.ensureOpenClawRunningForCowork).toBe(
      lifecycleSupport.ensureOpenClawRunningForCowork,
    );

    expect(capturedConfigDeps?.getStore).toBe(deps.getStore);
    expect(capturedConfigDeps?.getCoworkStore).toBe(deps.getCoworkStore);
    expect(capturedConfigDeps?.getSkillManager).toBe(deps.getSkillManager);
    expect(capturedConfigDeps?.getIMGatewayManager).toBe(
      deps.getIMGatewayManager,
    );
    expect(capturedConfigDeps?.getFeishuRuntimeOwnership).toBe(
      deps.getFeishuRuntimeOwnership,
    );
    expect(capturedConfigDeps?.resolveFeishuIMAgentEngine).toBe(
      deps.resolveFeishuIMAgentEngine,
    );
    expect(capturedConfigDeps?.getOpenClawRuntimeAdapter).toBe(
      deps.getOpenClawRuntimeAdapter,
    );
    expect(capturedConfigDeps?.getCronJobService).toBe(
      deps.getCronJobService,
    );
    expect(capturedConfigDeps?.getMcpBridgeConfig).toBe(
      deps.getMcpBridgeConfig,
    );
    expect(capturedConfigDeps?.getOpenClawEngineManager).toBe(
      support.getOpenClawEngineManager,
    );

    expect(capturedLifecycleDeps?.getCoworkStore).toBe(deps.getCoworkStore);
    expect(capturedLifecycleDeps?.startMcpBridge).toBe(deps.startMcpBridge);
    expect(capturedLifecycleDeps?.getMcpBridgeConfig).toBe(
      deps.getMcpBridgeConfig,
    );
    expect(capturedLifecycleDeps?.ensureDefaultIdentity).toBe(
      deps.ensureDefaultIdentity,
    );
    expect(capturedLifecycleDeps?.getOpenClawEngineManager).toBe(
      support.getOpenClawEngineManager,
    );
    expect(capturedLifecycleDeps?.bindOpenClawStatusForwarder).toBe(
      support.bindOpenClawStatusForwarder,
    );
    expect(capturedLifecycleDeps?.syncOpenClawConfig).toBe(
      configSupport.syncOpenClawConfig,
    );

    const manager = support.getOpenClawEngineManager();
    expect(manager).toBe(support.getOpenClawEngineManager());
    expect(support.peekOpenClawEngineManager()).toBe(manager);
    expect(openClawSupportTestState.managerInstances).toHaveLength(1);
  });

  it('binds the status forwarder once and broadcasts current and subsequent statuses to live windows', () => {
    const deps = createDeps();
    const activeWindow = deps.getWindows()[0];
    const configSupport = {
      getOpenClawConfigSync: vi.fn(),
      syncOpenClawConfig: vi.fn(),
      detectLocalOpenClawFeishu: vi.fn(),
      hasLocalOpenClawFeishuConfigured: vi.fn(),
    };
    const lifecycleSupport = {
      bootstrapOpenClawEngine: vi.fn(),
      getPendingTokenRefresh: vi.fn(),
      setPendingTokenRefresh: vi.fn(),
      ensureOpenClawRunningForCowork: vi.fn(),
    };

    openClawSupportTestState.createOpenClawConfigSupport.mockReturnValue(
      configSupport as never,
    );
    openClawSupportTestState.createOpenClawEngineLifecycleSupport.mockReturnValue(
      lifecycleSupport as never,
    );

    const support = createOpenClawEngineSupport(deps as never);
    support.bindOpenClawStatusForwarder();
    support.bindOpenClawStatusForwarder();

    const manager = openClawSupportTestState.managerInstances[0];
    expect(manager?.on).toHaveBeenCalledTimes(1);
    expect(activeWindow?.webContents.send).toHaveBeenCalledWith(
      'openclaw:engine:onProgress',
      {
        phase: 'ready',
        message: 'ready',
        canRetry: true,
      },
    );

    const nextStatus = {
      phase: 'running',
      message: 'running',
      canRetry: true,
    };
    manager?.emitStatus(nextStatus);

    expect(activeWindow?.webContents.send).toHaveBeenLastCalledWith(
      'openclaw:engine:onProgress',
      nextStatus,
    );
  });
});
