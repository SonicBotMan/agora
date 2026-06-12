import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOpenClawEngineLifecycleSupport } from './coworkEngineOpenClawLifecycleSupport';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

function createDeps(options: {
  initialStatus?: { phase: string; message?: string; gatewayMode?: string };
  ensuredStatus?: { phase: string; message?: string; gatewayMode?: string };
  startedStatus?: { phase: string; message?: string; gatewayMode?: string };
  syncResult?: {
    success: boolean;
    changed: boolean;
    status?: { phase: string; message?: string; gatewayMode?: string };
    error?: string;
  };
  startMcpBridge?: ReturnType<typeof vi.fn>;
  getMcpBridgeConfig?: ReturnType<typeof vi.fn>;
  ensureDefaultIdentity?: ReturnType<typeof vi.fn>;
  ensureReady?: ReturnType<typeof vi.fn>;
  startGateway?: ReturnType<typeof vi.fn>;
  stopGateway?: ReturnType<typeof vi.fn>;
} = {}) {
  const status = {
    value: options.initialStatus ?? {
      phase: 'stopped',
      message: 'stopped',
    },
  };
  const bridgeConfig = {
    callbackUrl: 'http://127.0.0.1:4010/mcp',
    tools: [{ name: 'tool-1' }],
    secret: 'secret',
  };
  const manager = {
    getStatus: vi.fn(() => status.value),
    ensureReady:
      options.ensureReady
      ?? vi.fn().mockResolvedValue(
        options.ensuredStatus ?? {
          phase: 'ready',
          message: 'ready',
        },
      ),
    startGateway:
      options.startGateway
      ?? vi.fn().mockImplementation(async () => {
        const nextStatus = options.startedStatus ?? {
          phase: 'running',
          message: 'running',
        };
        status.value = nextStatus;
        return nextStatus;
      }),
    stopGateway: options.stopGateway ?? vi.fn().mockResolvedValue(undefined),
  };
  const deps = {
    getCoworkStore: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({
        workingDirectory: '/tmp/agora-workspace',
      }),
    }),
    startMcpBridge:
      options.startMcpBridge ?? vi.fn().mockResolvedValue(bridgeConfig),
    getMcpBridgeConfig:
      options.getMcpBridgeConfig ?? vi.fn().mockReturnValue(bridgeConfig),
    ensureDefaultIdentity: options.ensureDefaultIdentity ?? vi.fn(),
    getOpenClawEngineManager: vi.fn().mockReturnValue(manager),
    bindOpenClawStatusForwarder: vi.fn(),
    syncOpenClawConfig: vi.fn().mockResolvedValue(
      options.syncResult ?? {
        success: true,
        changed: true,
      },
    ),
  };

  return {
    deps,
    manager,
    status,
  };
}

describe('coworkEngineOpenClawLifecycleSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reuses an in-flight bootstrap run and resets the guard after completion', async () => {
    const bridgeDeferred = createDeferred<{
      callbackUrl: string;
      tools: Array<{ name: string }>;
      secret: string;
    } | null>();
    const startMcpBridge = vi
      .fn()
      .mockReturnValueOnce(bridgeDeferred.promise)
      .mockResolvedValue({
        callbackUrl: 'http://127.0.0.1:4010/mcp',
        tools: [{ name: 'tool-1' }],
        secret: 'secret',
      });
    const { deps, manager } = createDeps({
      startMcpBridge,
    });
    const support = createOpenClawEngineLifecycleSupport(deps as never);

    const firstBootstrap = support.bootstrapOpenClawEngine({
      reason: 'first-pass',
    });
    const secondBootstrap = support.bootstrapOpenClawEngine({
      reason: 'second-pass',
    });

    expect(deps.bindOpenClawStatusForwarder).toHaveBeenCalledTimes(1);
    expect(startMcpBridge).toHaveBeenCalledTimes(1);

    bridgeDeferred.resolve({
      callbackUrl: 'http://127.0.0.1:4010/mcp',
      tools: [{ name: 'tool-1' }],
      secret: 'secret',
    });

    await expect(
      Promise.all([firstBootstrap, secondBootstrap]),
    ).resolves.toEqual([
      {
        phase: 'running',
        message: 'running',
      },
      {
        phase: 'running',
        message: 'running',
      },
    ]);

    expect(deps.ensureDefaultIdentity).toHaveBeenCalledWith(
      '/tmp/agora-workspace',
    );
    expect(deps.syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'bootstrap:first-pass',
      restartGatewayIfRunning: false,
    });
    expect(manager.ensureReady).toHaveBeenCalledWith({
      forceReinstall: false,
    });
    expect(manager.startGateway).toHaveBeenCalledTimes(1);

    await expect(
      support.bootstrapOpenClawEngine({ reason: 'third-pass' }),
    ).resolves.toEqual({
      phase: 'running',
      message: 'running',
    });
    expect(startMcpBridge).toHaveBeenCalledTimes(2);
    expect(deps.bindOpenClawStatusForwarder).toHaveBeenCalledTimes(2);
  });

  it('continues bootstrap when ensureDefaultIdentity fails and honors forceReinstall', async () => {
    const { deps, manager } = createDeps({
      ensureDefaultIdentity: vi.fn(() => {
        throw new Error('identity-missing');
      }),
    });
    const support = createOpenClawEngineLifecycleSupport(deps as never);

    await expect(
      support.bootstrapOpenClawEngine({
        reason: 'reinstall',
        forceReinstall: true,
      }),
    ).resolves.toEqual({
      phase: 'running',
      message: 'running',
    });

    expect(manager.stopGateway).toHaveBeenCalledTimes(1);
    expect(manager.ensureReady).toHaveBeenCalledWith({
      forceReinstall: true,
    });
    expect(manager.startGateway).toHaveBeenCalledTimes(1);
  });

  it('returns sync failure status and skips the remaining bootstrap work', async () => {
    const syncFailureStatus = {
      phase: 'error',
      message: 'sync failed',
    };
    const { deps, manager } = createDeps({
      syncResult: {
        success: false,
        changed: false,
        status: syncFailureStatus,
        error: 'bad-config',
      },
    });
    const support = createOpenClawEngineLifecycleSupport(deps as never);

    await expect(
      support.bootstrapOpenClawEngine({ reason: 'sync-failure' }),
    ).resolves.toEqual(syncFailureStatus);

    expect(manager.stopGateway).not.toHaveBeenCalled();
    expect(manager.ensureReady).not.toHaveBeenCalled();
    expect(manager.startGateway).not.toHaveBeenCalled();
  });

  it('waits for pending token refresh and short-circuits when the gateway is already running', async () => {
    const refreshDeferred = createDeferred<string | null>();
    const { deps, manager } = createDeps({
      initialStatus: {
        phase: 'running',
        message: 'running',
      },
    });
    const support = createOpenClawEngineLifecycleSupport(deps as never);
    support.setPendingTokenRefresh(refreshDeferred.promise);

    const ensurePromise = support.ensureOpenClawRunningForCowork();
    await Promise.resolve();

    expect(deps.startMcpBridge).not.toHaveBeenCalled();

    refreshDeferred.resolve('token');

    await expect(ensurePromise).resolves.toEqual({
      phase: 'running',
      message: 'running',
    });

    expect(deps.startMcpBridge).toHaveBeenCalledTimes(1);
    expect(deps.syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'ensureRunning:mcpBridge',
      restartGatewayIfRunning: false,
    });
    expect(manager.startGateway).not.toHaveBeenCalled();
  });

  it('starts the gateway when ensureRunning finds the gateway stopped despite non-fatal startup errors', async () => {
    const { deps, manager } = createDeps({
      startMcpBridge: vi.fn().mockRejectedValue(new Error('bridge-failed')),
      syncResult: {
        success: false,
        changed: false,
        error: 'sync-failed',
      },
      initialStatus: {
        phase: 'stopped',
        message: 'stopped',
      },
    });
    const support = createOpenClawEngineLifecycleSupport(deps as never);

    await expect(support.ensureOpenClawRunningForCowork()).resolves.toEqual({
      phase: 'running',
      message: 'running',
    });

    expect(deps.syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'ensureRunning:mcpBridge',
      restartGatewayIfRunning: false,
    });
    expect(manager.startGateway).toHaveBeenCalledTimes(1);
  });
});
