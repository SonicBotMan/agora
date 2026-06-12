import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainRuntimeRegistryCoworkRouterRuntimeSupportTestState = vi.hoisted(() => {
  const createCoworkRouterRuntime = vi.fn();
  const getCronJobService = vi.fn();

  return {
    createCoworkRouterRuntime,
    getCronJobService,
  };
});

vi.mock('./coworkRouterRuntime', () => ({
  createCoworkRouterRuntime:
    mainRuntimeRegistryCoworkRouterRuntimeSupportTestState.createCoworkRouterRuntime,
}));

vi.mock('./ipcHandlers/scheduledTask', () => ({
  getCronJobService:
    mainRuntimeRegistryCoworkRouterRuntimeSupportTestState.getCronJobService,
}));

import { createMainRuntimeRegistryCoworkRouterRuntimeSupport } from './mainRuntimeRegistryCoworkRouterRuntimeSupport';

describe('mainRuntimeRegistryCoworkRouterRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates cowork router runtime and injects MCP-enabled servers plus cron service wiring', () => {
    const deps = {
      getCoworkStore: vi.fn(),
      getMcpBridgeRuntime: vi.fn().mockReturnValue({
        getMcpStore: vi.fn().mockReturnValue({
          getEnabledServers: vi.fn().mockReturnValue(['server-1']),
        }),
      }),
      getExternalAgentProviderStore: vi.fn(),
      getRuntimeTelemetryTracker: vi.fn(),
      getDeepSeekTuiRuntimeManager: vi.fn(),
      getOpenClawEngineManager: vi.fn(),
      getHermesEngineManager: vi.fn(),
      ensureHermesRunningForCowork: vi.fn(),
      resolveCoworkAgentEngine: vi.fn(),
      getIMGatewayManager: vi.fn(),
    };
    const runtime = {
      peekCoworkEngineRouter: vi.fn().mockReturnValue('engine-router'),
      peekOpenClawRuntimeAdapter: vi.fn().mockReturnValue('openclaw-adapter'),
      getCoworkEngineRouter: vi.fn().mockReturnValue('engine-router'),
    };
    let capturedDeps: Record<string, unknown> | null = null;

    mainRuntimeRegistryCoworkRouterRuntimeSupportTestState.getCronJobService
      .mockReturnValue('cron-service');
    mainRuntimeRegistryCoworkRouterRuntimeSupportTestState.createCoworkRouterRuntime
      .mockImplementation((input) => {
        capturedDeps = input as never;
        return runtime as never;
      });

    const support = createMainRuntimeRegistryCoworkRouterRuntimeSupport(
      deps as never,
    );

    expect(support.peekCoworkEngineRouter()).toBeNull();
    expect(support.peekOpenClawRuntimeAdapter()).toBeNull();
    expect(support.getCoworkEngineRouter()).toBe('engine-router');
    expect(support.peekCoworkEngineRouter()).toBe('engine-router');
    expect(support.peekOpenClawRuntimeAdapter()).toBe('openclaw-adapter');

    expect(
      mainRuntimeRegistryCoworkRouterRuntimeSupportTestState.createCoworkRouterRuntime,
    ).toHaveBeenCalledTimes(1);
    expect(capturedDeps).toMatchObject({
      getCoworkStore: deps.getCoworkStore,
      getOpenClawEngineManager: deps.getOpenClawEngineManager,
      getHermesEngineManager: deps.getHermesEngineManager,
      getDeepSeekTuiRuntimeManager: deps.getDeepSeekTuiRuntimeManager,
      getExternalAgentProviderStore: deps.getExternalAgentProviderStore,
      ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
      resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
      getRuntimeTelemetryTracker: deps.getRuntimeTelemetryTracker,
      getIMGatewayManager: deps.getIMGatewayManager,
    });
    expect(capturedDeps?.getCronJobService).toBe(
      mainRuntimeRegistryCoworkRouterRuntimeSupportTestState.getCronJobService,
    );
    expect(
      (
        capturedDeps?.getEnabledMcpServers as (() => unknown) | undefined
      )?.(),
    ).toEqual(['server-1']);
  });
});
