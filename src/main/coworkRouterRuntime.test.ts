import os from 'os';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine as CoworkAgentEngineValue } from '../shared/cowork/constants';

const coworkRouterRuntimeTestState = vi.hoisted(() => {
  const coworkRunnerInstances: Array<{
    store: unknown;
    provider: (() => unknown) | null;
    setMcpServerProvider: ReturnType<typeof vi.fn>;
  }> = [];
  const openClawRuntimeAdapterInstances: Array<{
    store: unknown;
    manager: unknown;
    setChannelSessionSync: ReturnType<typeof vi.fn>;
  }> = [];
  const hermesRuntimeAdapterInstances: Array<{
    options: Record<string, unknown>;
  }> = [];
  const externalCliRuntimeAdapterInstances: Array<{
    options: Record<string, unknown>;
  }> = [];
  const deepSeekTuiRuntimeAdapterInstances: Array<{
    options: Record<string, unknown>;
  }> = [];
  const coworkEngineRouterInstances: Array<{
    options: Record<string, unknown>;
  }> = [];
  const channelSessionSyncInstances: Array<{
    options: Record<string, unknown>;
  }> = [];

  class MockCoworkRunner {
    store: unknown;
    provider: (() => unknown) | null;
    setMcpServerProvider: ReturnType<typeof vi.fn>;

    constructor(store: unknown) {
      this.store = store;
      this.provider = null;
      this.setMcpServerProvider = vi.fn((provider: () => unknown) => {
        this.provider = provider;
      });
      coworkRunnerInstances.push(this);
    }
  }

  class MockOpenClawRuntimeAdapter {
    store: unknown;
    manager: unknown;
    setChannelSessionSync: ReturnType<typeof vi.fn>;

    constructor(store: unknown, manager: unknown) {
      this.store = store;
      this.manager = manager;
      this.setChannelSessionSync = vi.fn();
      openClawRuntimeAdapterInstances.push(this);
    }
  }

  class MockHermesRuntimeAdapter {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      hermesRuntimeAdapterInstances.push(this);
    }
  }

  class MockExternalCliRuntimeAdapter {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      externalCliRuntimeAdapterInstances.push(this);
    }
  }

  class MockDeepSeekTuiRuntimeAdapter {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      deepSeekTuiRuntimeAdapterInstances.push(this);
    }
  }

  class MockCoworkEngineRouter {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      coworkEngineRouterInstances.push(this);
    }
  }

  class MockOpenClawChannelSessionSync {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      channelSessionSyncInstances.push(this);
    }
  }

  return {
    coworkRunnerInstances,
    openClawRuntimeAdapterInstances,
    hermesRuntimeAdapterInstances,
    externalCliRuntimeAdapterInstances,
    deepSeekTuiRuntimeAdapterInstances,
    coworkEngineRouterInstances,
    channelSessionSyncInstances,
    MockCoworkRunner,
    MockOpenClawRuntimeAdapter,
    MockHermesRuntimeAdapter,
    MockExternalCliRuntimeAdapter,
    MockDeepSeekTuiRuntimeAdapter,
    MockCoworkEngineRouter,
    MockOpenClawChannelSessionSync,
  };
});

vi.mock('./libs/coworkRunner', () => ({
  CoworkRunner: coworkRouterRuntimeTestState.MockCoworkRunner,
}));

vi.mock('./libs/openclawChannelSessionSync', () => ({
  OpenClawChannelSessionSync:
    coworkRouterRuntimeTestState.MockOpenClawChannelSessionSync,
}));

vi.mock('./libs/agentEngine', () => ({
  CoworkEngineRouter: coworkRouterRuntimeTestState.MockCoworkEngineRouter,
  DeepSeekTuiRuntimeAdapter:
    coworkRouterRuntimeTestState.MockDeepSeekTuiRuntimeAdapter,
  ExternalCliRuntimeAdapter:
    coworkRouterRuntimeTestState.MockExternalCliRuntimeAdapter,
  HermesRuntimeAdapter: coworkRouterRuntimeTestState.MockHermesRuntimeAdapter,
  OpenClawRuntimeAdapter:
    coworkRouterRuntimeTestState.MockOpenClawRuntimeAdapter,
}));

import { createCoworkRouterRuntime } from './coworkRouterRuntime';

function createDeps(options: {
  workingDirectory?: string;
  imStore?: unknown;
  throwOnGetIMGatewayManager?: boolean;
} = {}) {
  const coworkStore = {
    getConfig: vi.fn().mockReturnValue({
      workingDirectory: options.workingDirectory ?? '/tmp/agora-project',
    }),
  };
  const openClawEngineManager = { id: 'openclaw-manager' };
  const hermesEngineManager = { id: 'hermes-manager' };
  const deepSeekTuiRuntimeManager = { id: 'deepseek-runtime-manager' };
  const telemetryTracker = { id: 'telemetry-tracker' };
  const enabledMcpServers = [{ id: 'mcp-server-1' }];
  const externalAgentProviderStore = {
    getCurrentProvider: vi
      .fn()
      .mockImplementation((appType: string) => `provider:${appType}`),
  };
  const imGatewayManager = {
    getIMStore: vi.fn().mockReturnValue(options.imStore ?? { id: 'im-store' }),
  };
  const deps = {
    getCoworkStore: vi.fn().mockReturnValue(coworkStore),
    getOpenClawEngineManager: vi.fn().mockReturnValue(openClawEngineManager),
    getHermesEngineManager: vi.fn().mockReturnValue(hermesEngineManager),
    getDeepSeekTuiRuntimeManager: vi
      .fn()
      .mockReturnValue(deepSeekTuiRuntimeManager),
    getExternalAgentProviderStore: vi
      .fn()
      .mockReturnValue(externalAgentProviderStore),
    ensureHermesRunningForCowork: vi
      .fn()
      .mockResolvedValue({ phase: 'running' }),
    resolveCoworkAgentEngine: vi
      .fn()
      .mockReturnValue(CoworkAgentEngineValue.OpenClaw),
    getRuntimeTelemetryTracker: vi.fn().mockReturnValue(telemetryTracker),
    getIMGatewayManager: options.throwOnGetIMGatewayManager
      ? vi.fn(() => {
        throw new Error('im-bootstrap-failed');
      })
      : vi.fn().mockReturnValue(imGatewayManager),
    getCronJobService: vi.fn().mockReturnValue({
      getJobNameSync: vi.fn((jobId: string) => `job:${jobId}`),
    }),
    getEnabledMcpServers: vi.fn().mockReturnValue(enabledMcpServers),
  };

  return {
    deps,
    coworkStore,
    openClawEngineManager,
    hermesEngineManager,
    deepSeekTuiRuntimeManager,
    telemetryTracker,
    externalAgentProviderStore,
    imGatewayManager,
    enabledMcpServers,
  };
}

describe('coworkRouterRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coworkRouterRuntimeTestState.coworkRunnerInstances.length = 0;
    coworkRouterRuntimeTestState.openClawRuntimeAdapterInstances.length = 0;
    coworkRouterRuntimeTestState.hermesRuntimeAdapterInstances.length = 0;
    coworkRouterRuntimeTestState.externalCliRuntimeAdapterInstances.length = 0;
    coworkRouterRuntimeTestState.deepSeekTuiRuntimeAdapterInstances.length = 0;
    coworkRouterRuntimeTestState.coworkEngineRouterInstances.length = 0;
    coworkRouterRuntimeTestState.channelSessionSyncInstances.length = 0;
  });

  it('lazily creates singleton runner and engine router instances with all engine adapters wired', () => {
    const {
      deps,
      coworkStore,
      openClawEngineManager,
      hermesEngineManager,
      deepSeekTuiRuntimeManager,
      telemetryTracker,
      externalAgentProviderStore,
      enabledMcpServers,
    } = createDeps();
    const runtime = createCoworkRouterRuntime(deps as never);

    expect(runtime.peekCoworkRunner()).toBeNull();
    expect(runtime.peekCoworkEngineRouter()).toBeNull();
    expect(runtime.peekOpenClawRuntimeAdapter()).toBeNull();

    const firstRunner = runtime.getCoworkRunner();
    const secondRunner = runtime.getCoworkRunner();

    expect(firstRunner).toBe(secondRunner);
    expect(coworkRouterRuntimeTestState.coworkRunnerInstances).toHaveLength(1);
    expect(
      coworkRouterRuntimeTestState.coworkRunnerInstances[0]?.store,
    ).toBe(coworkStore);
    expect(
      coworkRouterRuntimeTestState.coworkRunnerInstances[0]?.setMcpServerProvider,
    ).toHaveBeenCalledTimes(1);
    expect(
      coworkRouterRuntimeTestState.coworkRunnerInstances[0]?.provider?.(),
    ).toBe(enabledMcpServers);
    expect(deps.getEnabledMcpServers).toHaveBeenCalledTimes(1);

    const firstRouter = runtime.getCoworkEngineRouter();
    const secondRouter = runtime.getCoworkEngineRouter();

    expect(firstRouter).toBe(secondRouter);
    expect(runtime.peekCoworkEngineRouter()).toBe(firstRouter);
    expect(coworkRouterRuntimeTestState.coworkEngineRouterInstances).toHaveLength(
      1,
    );
    expect(
      coworkRouterRuntimeTestState.openClawRuntimeAdapterInstances,
    ).toHaveLength(1);
    expect(
      coworkRouterRuntimeTestState.hermesRuntimeAdapterInstances,
    ).toHaveLength(1);
    expect(
      coworkRouterRuntimeTestState.deepSeekTuiRuntimeAdapterInstances,
    ).toHaveLength(1);
    expect(
      coworkRouterRuntimeTestState.externalCliRuntimeAdapterInstances,
    ).toHaveLength(3);
    expect(runtime.peekOpenClawRuntimeAdapter()).toBe(
      coworkRouterRuntimeTestState.openClawRuntimeAdapterInstances[0],
    );

    const openClawAdapter =
      coworkRouterRuntimeTestState.openClawRuntimeAdapterInstances[0];
    expect(openClawAdapter?.store).toBe(coworkStore);
    expect(openClawAdapter?.manager).toBe(openClawEngineManager);
    expect(
      coworkRouterRuntimeTestState.channelSessionSyncInstances,
    ).toHaveLength(1);
    expect(openClawAdapter?.setChannelSessionSync).toHaveBeenCalledWith(
      coworkRouterRuntimeTestState.channelSessionSyncInstances[0],
    );

    const channelSessionSync =
      coworkRouterRuntimeTestState.channelSessionSyncInstances[0];
    expect(channelSessionSync?.options.coworkStore).toBe(coworkStore);
    expect(channelSessionSync?.options.imStore).toEqual({ id: 'im-store' });
    expect(
      (
        channelSessionSync?.options.getDefaultCwd as (() => string) | undefined
      )?.(),
    ).toBe('/tmp/agora-project');
    expect(
      (
        channelSessionSync?.options.resolveJobName as (
          jobId: string,
        ) => string
      )('job-1'),
    ).toBe('job:job-1');

    const claudeAdapter =
      coworkRouterRuntimeTestState.externalCliRuntimeAdapterInstances.find(
        (instance) =>
          instance.options.engine === CoworkAgentEngineValue.ClaudeCode,
      );
    const codexAdapter =
      coworkRouterRuntimeTestState.externalCliRuntimeAdapterInstances.find(
        (instance) => instance.options.engine === CoworkAgentEngineValue.Codex,
      );
    const openCodeAdapter =
      coworkRouterRuntimeTestState.externalCliRuntimeAdapterInstances.find(
        (instance) =>
          instance.options.engine === CoworkAgentEngineValue.OpenCode,
      );
    expect(claudeAdapter?.options.store).toBe(coworkStore);
    expect(codexAdapter?.options.store).toBe(coworkStore);
    expect(openCodeAdapter?.options.store).toBe(coworkStore);
    expect(
      (
        claudeAdapter?.options.getCurrentProvider as (
          appType: string,
        ) => string
      )('claude-code'),
    ).toBe('provider:claude-code');
    expect(externalAgentProviderStore.getCurrentProvider).toHaveBeenCalledWith(
      'claude-code',
    );

    const deepSeekAdapter =
      coworkRouterRuntimeTestState.deepSeekTuiRuntimeAdapterInstances[0];
    expect(deepSeekAdapter?.options.store).toBe(coworkStore);
    expect(deepSeekAdapter?.options.runtimeManager).toBe(
      deepSeekTuiRuntimeManager,
    );

    const hermesAdapter =
      coworkRouterRuntimeTestState.hermesRuntimeAdapterInstances[0];
    expect(hermesAdapter?.options.store).toBe(coworkStore);
    expect(hermesAdapter?.options.engineManager).toBe(hermesEngineManager);
    expect(hermesAdapter?.options.ensureRunning).toBe(
      deps.ensureHermesRunningForCowork,
    );

    const routerOptions =
      coworkRouterRuntimeTestState.coworkEngineRouterInstances[0]?.options;
    expect(routerOptions?.getCurrentEngine).toBe(deps.resolveCoworkAgentEngine);
    expect(routerOptions?.openclawRuntime).toBe(openClawAdapter);
    expect(routerOptions?.hermesRuntime).toBe(hermesAdapter);
    expect(routerOptions?.claudeCodeRuntime).toBe(claudeAdapter);
    expect(routerOptions?.codexRuntime).toBe(codexAdapter);
    expect(routerOptions?.openCodeRuntime).toBe(openCodeAdapter);
    expect(routerOptions?.deepSeekTuiRuntime).toBe(deepSeekAdapter);
    expect(routerOptions?.telemetryTracker).toBe(telemetryTracker);
  });

  it('falls back to os.homedir for channel session sync when no working directory is configured', () => {
    const { deps } = createDeps({
      workingDirectory: '',
    });
    const runtime = createCoworkRouterRuntime(deps as never);

    runtime.getCoworkEngineRouter();

    const channelSessionSync =
      coworkRouterRuntimeTestState.channelSessionSyncInstances[0];
    expect(
      (
        channelSessionSync?.options.getDefaultCwd as (() => string) | undefined
      )?.(),
    ).toBe(os.homedir());
  });

  it('logs and continues when IM session sync wiring fails', () => {
    const { deps } = createDeps({
      throwOnGetIMGatewayManager: true,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const runtime = createCoworkRouterRuntime(deps as never);

    expect(runtime.getCoworkEngineRouter()).toBeTruthy();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Main] Failed to set up channel session sync:',
      expect.any(Error),
    );
    expect(
      coworkRouterRuntimeTestState.channelSessionSyncInstances,
    ).toHaveLength(0);
    expect(
      coworkRouterRuntimeTestState.openClawRuntimeAdapterInstances[0]
        ?.setChannelSessionSync,
    ).not.toHaveBeenCalled();
  });
});
