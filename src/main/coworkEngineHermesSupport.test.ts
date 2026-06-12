import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';

const hermesTestState = vi.hoisted(() => {
  const hermesEngineManagerInstances: unknown[] = [];
  const hermesConfigSyncInstances: unknown[] = [];
  const syncHermesIMSessions = vi.fn();

  class MockHermesEngineManager {
    listeners: Array<(status: Record<string, unknown>) => void>;
    status: Record<string, unknown>;
    getStatus: ReturnType<typeof vi.fn>;
    ensureReady: ReturnType<typeof vi.fn>;
    startGateway: ReturnType<typeof vi.fn>;
    stopGateway: ReturnType<typeof vi.fn>;
    restartGateway: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;

    constructor() {
      this.listeners = [];
      this.status = {
        phase: 'ready',
        version: '1.0.0',
        canRetry: false,
        message: 'Hermes ready',
      };
      this.getStatus = vi.fn(() => this.status);
      this.ensureReady = vi.fn(async () => this.status);
      this.startGateway = vi.fn(async () => {
        this.status = {
          phase: 'running',
          version: '1.0.0',
          canRetry: false,
          message: 'Hermes running',
        };
        return this.status;
      });
      this.stopGateway = vi.fn(async () => undefined);
      this.restartGateway = vi.fn(async () => {
        this.status = {
          phase: 'running',
          version: '1.0.0',
          canRetry: false,
          message: 'Hermes restarted',
        };
        return this.status;
      });
      this.on = vi.fn(
        (event: string, listener: (status: Record<string, unknown>) => void) => {
          if (event === 'status') {
            this.listeners.push(listener);
          }
          return this;
        },
      );
      hermesEngineManagerInstances.push(this);
    }

    emitStatus(status: Record<string, unknown>): void {
      for (const listener of this.listeners) {
        listener(status);
      }
    }
  }

  class MockHermesConfigSync {
    deps: Record<string, unknown>;
    sync: ReturnType<typeof vi.fn>;

    constructor(deps: Record<string, unknown>) {
      this.deps = deps;
      this.sync = vi.fn().mockReturnValue({
        success: true,
        changed: false,
      });
      hermesConfigSyncInstances.push(this);
    }
  }

  return {
    hermesEngineManagerInstances,
    hermesConfigSyncInstances,
    syncHermesIMSessions,
    MockHermesEngineManager,
    MockHermesConfigSync,
  };
});

vi.mock('./libs/hermesEngineManager', () => ({
  HermesEngineManager: hermesTestState.MockHermesEngineManager,
}));

vi.mock('./libs/hermesConfigSync', () => ({
  HermesConfigSync: hermesTestState.MockHermesConfigSync,
}));

vi.mock('./libs/hermesImSessionSync', () => ({
  syncHermesIMSessions: hermesTestState.syncHermesIMSessions,
}));

import { createHermesEngineSupport } from './coworkEngineHermesSupport';

function createDeps(options: {
  resolveFeishuIMAgentEngine?: () => CoworkAgentEngine;
  imConfig?: Record<string, unknown>;
} = {}) {
  const activeSend = vi.fn();
  const destroyedSend = vi.fn();
  const coworkStore = {
    getConfig: vi.fn().mockReturnValue({
      workingDirectory: '/workspace',
      systemPrompt: 'system',
      executionMode: 'local',
    }),
  };
  const imStore = {
    getFeishuInstances: vi.fn().mockReturnValue([
      { id: 'instance-1', enabled: true, appId: 'app-id', appSecret: 'secret' },
    ]),
  };
  const imGatewayManager = {
    getConfig: vi.fn().mockReturnValue(
      options.imConfig ?? {
        feishu: {
          instances: [
            {
              enabled: true,
              appId: 'app-id',
              appSecret: 'secret',
            },
          ],
        },
      },
    ),
    getIMStore: vi.fn().mockReturnValue(imStore),
  };
  const coworkRuntimeForwarder = {
    broadcastSessionsChanged: vi.fn(),
  };
  const deps = {
    getWindows: () => [
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: activeSend },
      } as never,
      {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: destroyedSend },
      } as never,
    ],
    getCoworkStore: () => coworkStore as never,
    getIMGatewayManager: () => imGatewayManager as never,
    getFeishuRuntimeOwnership: vi.fn().mockReturnValue('agora'),
    getCoworkRuntimeForwarder: () => coworkRuntimeForwarder as never,
    resolveFeishuIMAgentEngine:
      options.resolveFeishuIMAgentEngine
      ?? (() => CoworkAgentEngine.Hermes),
  };

  return {
    deps,
    activeSend,
    destroyedSend,
    coworkStore,
    imStore,
    coworkRuntimeForwarder,
  };
}

describe('coworkEngineHermesSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    hermesTestState.hermesEngineManagerInstances.length = 0;
    hermesTestState.hermesConfigSyncInstances.length = 0;
    hermesTestState.syncHermesIMSessions.mockReset();
    hermesTestState.syncHermesIMSessions.mockReturnValue({
      changed: false,
      importedSessions: 0,
      importedMessages: 0,
      latestUpdatedAt: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches Hermes manager/config sync and forwards initial and live status updates once', () => {
    const { deps, activeSend, destroyedSend } = createDeps();
    const support = createHermesEngineSupport(deps);

    const manager = support.getHermesEngineManager();
    const configSync = support.getHermesConfigSync();

    expect(support.getHermesEngineManager()).toBe(manager);
    expect(support.getHermesConfigSync()).toBe(configSync);
    expect(hermesTestState.hermesEngineManagerInstances).toHaveLength(1);
    expect(hermesTestState.hermesConfigSyncInstances).toHaveLength(1);
    expect(
      hermesTestState.hermesConfigSyncInstances[0]?.deps.getFeishuRuntimeOwnership(),
    ).toBe('agora');
    expect(
      hermesTestState.hermesConfigSyncInstances[0]?.deps.getFeishuInstances(),
    ).toEqual([
      { id: 'instance-1', enabled: true, appId: 'app-id', appSecret: 'secret' },
    ]);

    support.bindHermesStatusForwarder();
    support.bindHermesStatusForwarder();

    expect(activeSend).toHaveBeenCalledWith('hermes:engine:onProgress', {
      phase: 'ready',
      version: '1.0.0',
      canRetry: false,
      message: 'Hermes ready',
    });

    const nextStatus = {
      phase: 'running',
      version: '1.2.0',
      canRetry: false,
      message: 'running',
    };
    manager.emitStatus(nextStatus);

    expect(activeSend).toHaveBeenCalledWith(
      'hermes:engine:onProgress',
      nextStatus,
    );
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it('bootstraps Hermes by syncing config, optionally reinstalling, and starting the gateway', async () => {
    const { deps } = createDeps();
    const support = createHermesEngineSupport(deps);
    const manager = support.getHermesEngineManager() as never as InstanceType<
      typeof hermesTestState.MockHermesEngineManager
    >;
    const configSync = support.getHermesConfigSync() as never as InstanceType<
      typeof hermesTestState.MockHermesConfigSync
    >;
    const syncFailureStatus = {
      phase: 'error',
      version: null,
      canRetry: true,
      message: 'sync failed',
    };

    configSync.sync.mockReturnValueOnce({
      success: false,
      changed: false,
      status: syncFailureStatus,
    });

    await expect(
      support.bootstrapHermesEngine({ reason: 'sync-failure' }),
    ).resolves.toEqual(syncFailureStatus);

    configSync.sync.mockReturnValue({
      success: true,
      changed: false,
    });
    manager.ensureReady.mockResolvedValueOnce({
      phase: 'ready',
      version: '1.0.0',
      canRetry: false,
    });
    manager.startGateway.mockResolvedValueOnce({
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
    });

    await expect(
      support.bootstrapHermesEngine({
        forceReinstall: true,
        reason: 'manual-reinstall',
      }),
    ).resolves.toEqual({
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
    });

    expect(configSync.sync).toHaveBeenCalledWith(
      'bootstrap:manual-reinstall',
    );
    expect(manager.stopGateway).toHaveBeenCalledTimes(1);
    expect(manager.ensureReady).toHaveBeenCalledTimes(1);
    expect(manager.startGateway).toHaveBeenCalledTimes(1);
  });

  it('ensures Hermes is running by handling sync failure, restart, and start branches', async () => {
    const { deps } = createDeps();
    const support = createHermesEngineSupport(deps);
    const manager = support.getHermesEngineManager() as never as InstanceType<
      typeof hermesTestState.MockHermesEngineManager
    >;
    const configSync = support.getHermesConfigSync() as never as InstanceType<
      typeof hermesTestState.MockHermesConfigSync
    >;

    configSync.sync.mockReturnValueOnce({
      success: false,
      changed: false,
      error: 'bad sync',
      status: {
        phase: 'error',
        version: null,
        canRetry: true,
        message: 'bad sync',
      },
    });

    await expect(support.ensureHermesRunningForCowork()).resolves.toEqual({
      phase: 'error',
      version: null,
      canRetry: true,
      message: 'bad sync',
    });

    manager.status = {
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
      message: 'running',
    };
    configSync.sync.mockReturnValueOnce({
      success: true,
      changed: true,
    });
    manager.restartGateway.mockResolvedValueOnce({
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
      message: 'restarted',
    });

    await expect(support.ensureHermesRunningForCowork()).resolves.toEqual({
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
      message: 'restarted',
    });

    manager.status = {
      phase: 'starting',
      version: '1.0.0',
      canRetry: false,
      message: 'starting',
    };
    configSync.sync.mockReturnValueOnce({
      success: true,
      changed: false,
    });
    manager.startGateway.mockResolvedValueOnce({
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
      message: 'started',
    });

    await expect(support.ensureHermesRunningForCowork()).resolves.toEqual({
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
      message: 'started',
    });
  });

  it('syncs Hermes IM sessions only when Hermes Feishu is active and deduplicates unchanged fingerprints', async () => {
    const { deps, coworkRuntimeForwarder, coworkStore, imStore } = createDeps();
    const support = createHermesEngineSupport(deps);

    hermesTestState.syncHermesIMSessions
      .mockReturnValueOnce({
        changed: true,
        importedSessions: 2,
        importedMessages: 5,
        latestUpdatedAt: 100,
      })
      .mockReturnValueOnce({
        changed: true,
        importedSessions: 2,
        importedMessages: 5,
        latestUpdatedAt: 100,
      })
      .mockReturnValueOnce({
        changed: true,
        importedSessions: 3,
        importedMessages: 7,
        latestUpdatedAt: 101,
      });

    await support.syncHermesIMSessionsToCowork('first');
    await support.syncHermesIMSessionsToCowork('same-fingerprint');
    await support.syncHermesIMSessionsToCowork('changed-fingerprint');

    expect(hermesTestState.syncHermesIMSessions).toHaveBeenNthCalledWith(1, {
      coworkStore: deps.getCoworkStore(),
      imStore,
      cwd: '/workspace',
      systemPrompt: 'system',
      executionMode: 'local',
      agentId: 'main',
    });
    expect(coworkStore.getConfig).toHaveBeenCalledTimes(3);
    expect(coworkRuntimeForwarder.broadcastSessionsChanged).toHaveBeenCalledTimes(
      2,
    );
  });

  it('skips Hermes IM session sync when Hermes Feishu is not the active engine or credentials are incomplete', async () => {
    const inactiveEngine = createDeps({
      resolveFeishuIMAgentEngine: () => CoworkAgentEngine.OpenClaw,
    });
    const inactiveSupport = createHermesEngineSupport(inactiveEngine.deps);

    await inactiveSupport.syncHermesIMSessionsToCowork('inactive-engine');

    const incompleteConfig = createDeps({
      imConfig: {
        feishu: {
          instances: [
            {
              enabled: true,
              appId: 'app-id',
              appSecret: '',
            },
          ],
        },
      },
    });
    const incompleteSupport = createHermesEngineSupport(incompleteConfig.deps);

    await incompleteSupport.syncHermesIMSessionsToCowork('incomplete-config');

    expect(hermesTestState.syncHermesIMSessions).not.toHaveBeenCalled();
  });

  it('starts and stops Hermes IM session sync polling without duplicating timers', async () => {
    vi.useFakeTimers();
    const { deps } = createDeps();
    const support = createHermesEngineSupport(deps);

    hermesTestState.syncHermesIMSessions.mockReturnValue({
      changed: false,
      importedSessions: 0,
      importedMessages: 0,
      latestUpdatedAt: 0,
    });

    support.startHermesIMSessionSyncPolling();
    support.startHermesIMSessionSyncPolling();
    await Promise.resolve();

    expect(hermesTestState.syncHermesIMSessions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_000);

    expect(hermesTestState.syncHermesIMSessions).toHaveBeenCalledTimes(2);

    support.stopHermesIMSessionSyncPolling();
    await vi.advanceTimersByTimeAsync(8_000);

    expect(hermesTestState.syncHermesIMSessions).toHaveBeenCalledTimes(2);
  });
});
