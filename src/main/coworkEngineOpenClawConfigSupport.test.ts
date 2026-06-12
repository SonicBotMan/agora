import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalAgentConfigSource } from '../shared/cowork/constants';

const openClawConfigSupportTestState = vi.hoisted(() => {
  const configSync = {
    sync: vi.fn(),
    collectSecretEnvVars: vi.fn(),
  };
  const getterFactory = vi.fn(() => () => configSync);
  const feishuSupport = {
    shouldWriteOpenClawFeishuChannel: vi.fn().mockReturnValue(true),
    isFeishuManagedByOpenClawConfig: vi.fn().mockReturnValue(true),
    detectLocalOpenClawFeishu: vi.fn().mockReturnValue({
      configured: true,
      enabled: false,
    }),
    hasLocalOpenClawFeishuConfigured: vi.fn().mockReturnValue(true),
  };
  const createOpenClawConfigFeishuSupport = vi.fn(() => feishuSupport);
  const mergeEnterpriseOpenclawConfig = vi.fn();

  return {
    configSync,
    getterFactory,
    feishuSupport,
    createOpenClawConfigFeishuSupport,
    mergeEnterpriseOpenclawConfig,
  };
});

vi.mock('./coworkEngineOpenClawConfigSyncBuilderSupport', () => ({
  createOpenClawConfigSyncGetter:
    openClawConfigSupportTestState.getterFactory,
}));

vi.mock('./coworkEngineOpenClawFeishuSupport', () => ({
  createOpenClawConfigFeishuSupport:
    openClawConfigSupportTestState.createOpenClawConfigFeishuSupport,
}));

vi.mock('./libs/enterpriseConfigSync', () => ({
  mergeEnterpriseOpenclawConfig:
    openClawConfigSupportTestState.mergeEnterpriseOpenclawConfig,
}));

import { createOpenClawConfigSupport } from './coworkEngineOpenClawConfigSupport';

function createDeps(options: {
  syncResult?: Record<string, unknown>;
  openclawConfigSource?: string;
  status?: Record<string, unknown>;
  runtimeHasActiveSessions?: boolean;
  cronHasRunningJobs?: boolean;
  secretEnvVars?: Record<string, string>;
  nextSecretEnvVars?: Record<string, string>;
} = {}) {
  const runtimeHasActiveSessions = {
    value: options.runtimeHasActiveSessions ?? false,
  };
  const cronHasRunningJobs = {
    value: options.cronHasRunningJobs ?? false,
  };
  const status = {
    value: options.status ?? {
      phase: 'idle',
      gatewayMode: 'managed',
      message: 'idle',
    },
  };
  const secretEnvVars = {
    value: options.secretEnvVars ?? {},
  };
  const nextSecretEnvVars = options.nextSecretEnvVars ?? {};
  const restartedStatus = {
    phase: 'running',
    gatewayMode: 'managed',
    message: 'running',
  };
  const openClawRuntimeAdapter = {
    hasActiveSessions: vi.fn(() => runtimeHasActiveSessions.value),
    disconnectGatewayClient: vi.fn(),
  };
  const cronJobService = {
    hasRunningJobs: vi.fn(() => cronHasRunningJobs.value),
    getJobNameSync: vi.fn(),
  };
  const manager = {
    setExternalError: vi.fn((message: string) => ({
      phase: 'error',
      message,
      canRetry: true,
    })),
    getStatus: vi.fn(() => status.value),
    setSecretEnvVars: vi.fn((value: Record<string, string>) => {
      secretEnvVars.value = value;
    }),
    getSecretEnvVars: vi.fn(() => secretEnvVars.value),
    setRequireManagedGateway: vi.fn(),
    getConfigPath: vi.fn().mockReturnValue('/tmp/openclaw.json'),
    stopGateway: vi.fn(async () => undefined),
    startGateway: vi.fn(async () => {
      status.value = restartedStatus;
      return restartedStatus;
    }),
  };
  const deps = {
    getStore: vi.fn().mockReturnValue({ get: vi.fn() }),
    getCoworkStore: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({
        openclawConfigSource:
          options.openclawConfigSource
          ?? ExternalAgentConfigSource.AgoraModel,
      }),
    }),
    getSkillManager: vi.fn(),
    getIMGatewayManager: vi.fn(),
    getFeishuRuntimeOwnership: vi.fn(),
    resolveFeishuIMAgentEngine: vi.fn(),
    getOpenClawRuntimeAdapter: vi.fn().mockReturnValue(openClawRuntimeAdapter),
    getCronJobService: vi.fn().mockReturnValue(cronJobService),
    getMcpBridgeConfig: vi.fn(),
    getOpenClawEngineManager: vi.fn().mockReturnValue(manager),
  };

  openClawConfigSupportTestState.configSync.sync.mockImplementation(() => ({
    ok: true,
    changed: false,
    skipped: false,
    ...(options.syncResult ?? {}),
  }));
  openClawConfigSupportTestState.configSync.collectSecretEnvVars.mockReturnValue(
    nextSecretEnvVars,
  );

  return {
    deps,
    manager,
    openClawRuntimeAdapter,
    cronJobService,
    runtimeHasActiveSessions,
    cronHasRunningJobs,
    status,
    restartedStatus,
    secretEnvVars,
  };
}

describe('coworkEngineOpenClawConfigSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('proxies Feishu helpers and reports sync failures through the engine manager', async () => {
    const { deps, manager } = createDeps({
      syncResult: {
        ok: false,
        error: 'bad config',
      },
    });
    const support = createOpenClawConfigSupport(deps as never);

    expect(support.detectLocalOpenClawFeishu()).toEqual({
      configured: true,
      enabled: false,
    });
    expect(support.hasLocalOpenClawFeishuConfigured()).toBe(true);

    await expect(
      support.syncOpenClawConfig({ reason: 'failure-case' }),
    ).resolves.toEqual({
      success: false,
      changed: false,
      status: {
        phase: 'error',
        message: 'OpenClaw config sync failed: bad config',
        canRetry: true,
      },
      error: 'bad config',
    });
    expect(manager.setExternalError).toHaveBeenCalledWith(
      'OpenClaw config sync failed: bad config',
    );
  });

  it('applies managed gateway env state and exits early for skipped syncs', async () => {
    const { deps, manager } = createDeps({
      syncResult: {
        ok: true,
        skipped: true,
      },
      nextSecretEnvVars: {
        OPENCLAW_API_KEY: 'sk-test',
      },
    });
    const support = createOpenClawConfigSupport(deps as never);

    await expect(
      support.syncOpenClawConfig({ reason: 'skipped-case' }),
    ).resolves.toEqual({
      success: true,
      changed: false,
      status: {
        phase: 'idle',
        gatewayMode: 'managed',
        message: 'idle',
      },
    });

    expect(manager.setSecretEnvVars).toHaveBeenCalledWith({
      OPENCLAW_API_KEY: 'sk-test',
    });
    expect(manager.setRequireManagedGateway).toHaveBeenCalledWith(true);
    expect(
      openClawConfigSupportTestState.mergeEnterpriseOpenclawConfig,
    ).not.toHaveBeenCalled();
    expect(manager.stopGateway).not.toHaveBeenCalled();
  });

  it('restarts the gateway immediately when a hard restart is required and no workloads are active', async () => {
    const { deps, manager, openClawRuntimeAdapter } = createDeps({
      syncResult: {
        ok: true,
        changed: true,
      },
      status: {
        phase: 'running',
        gatewayMode: 'managed',
        message: 'running',
      },
    });
    const support = createOpenClawConfigSupport(deps as never);

    await expect(
      support.syncOpenClawConfig({
        reason: 'manual-restart',
        restartGatewayIfRunning: true,
      }),
    ).resolves.toEqual({
      success: true,
      changed: true,
      status: {
        phase: 'running',
        gatewayMode: 'managed',
        message: 'running',
      },
    });

    expect(
      openClawConfigSupportTestState.mergeEnterpriseOpenclawConfig,
    ).toHaveBeenCalledWith('/tmp/openclaw.json');
    expect(openClawRuntimeAdapter.disconnectGatewayClient).toHaveBeenCalledTimes(
      1,
    );
    expect(manager.stopGateway).toHaveBeenCalledTimes(1);
    expect(manager.startGateway).toHaveBeenCalledTimes(1);
  });

  it('defers a required gateway restart until workloads finish and preserves restart intent', async () => {
    vi.useFakeTimers();
    const {
      deps,
      manager,
      openClawRuntimeAdapter,
      runtimeHasActiveSessions,
    } = createDeps({
      syncResult: {
        ok: true,
        changed: true,
      },
      runtimeHasActiveSessions: true,
      status: {
        phase: 'running',
        gatewayMode: 'managed',
        message: 'running',
      },
      secretEnvVars: {
        OPENCLAW_API_KEY: 'sk-stable',
      },
      nextSecretEnvVars: {
        OPENCLAW_API_KEY: 'sk-stable',
      },
    });
    const support = createOpenClawConfigSupport(deps as never);

    await expect(
      support.syncOpenClawConfig({
        reason: 'busy-restart',
        restartGatewayIfRunning: true,
      }),
    ).resolves.toEqual({
      success: true,
      changed: true,
      status: {
        phase: 'running',
        gatewayMode: 'managed',
        message: 'running',
      },
    });

    expect(manager.stopGateway).not.toHaveBeenCalled();
    expect(manager.startGateway).not.toHaveBeenCalled();

    runtimeHasActiveSessions.value = false;
    await vi.advanceTimersByTimeAsync(3_000);

    expect(openClawConfigSupportTestState.configSync.sync).toHaveBeenNthCalledWith(
      1,
      'busy-restart',
    );
    expect(openClawConfigSupportTestState.configSync.sync).toHaveBeenNthCalledWith(
      2,
      'deferred:busy-restart',
    );
    expect(openClawRuntimeAdapter.disconnectGatewayClient).toHaveBeenCalledTimes(
      1,
    );
    expect(manager.stopGateway).toHaveBeenCalledTimes(1);
    expect(manager.startGateway).toHaveBeenCalledTimes(1);
  });

  it('forces a deferred gateway restart after the max wait even if workloads stay active', async () => {
    vi.useFakeTimers();
    const { deps, manager, openClawRuntimeAdapter } = createDeps({
      syncResult: {
        ok: true,
        changed: true,
      },
      runtimeHasActiveSessions: true,
      status: {
        phase: 'running',
        gatewayMode: 'managed',
        message: 'running',
      },
      secretEnvVars: {
        OPENCLAW_API_KEY: 'sk-stable',
      },
      nextSecretEnvVars: {
        OPENCLAW_API_KEY: 'sk-stable',
      },
    });
    const support = createOpenClawConfigSupport(deps as never);

    await expect(
      support.syncOpenClawConfig({
        reason: 'timeout-restart',
        restartGatewayIfRunning: true,
      }),
    ).resolves.toEqual({
      success: true,
      changed: true,
      status: {
        phase: 'running',
        gatewayMode: 'managed',
        message: 'running',
      },
    });

    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(openClawConfigSupportTestState.configSync.sync).toHaveBeenNthCalledWith(
      1,
      'timeout-restart',
    );
    expect(openClawConfigSupportTestState.configSync.sync).toHaveBeenNthCalledWith(
      2,
      'deferred:timeout-restart',
    );
    expect(openClawRuntimeAdapter.disconnectGatewayClient).toHaveBeenCalledTimes(
      1,
    );
    expect(manager.stopGateway).toHaveBeenCalledTimes(1);
    expect(manager.startGateway).toHaveBeenCalledTimes(1);
  });
});
