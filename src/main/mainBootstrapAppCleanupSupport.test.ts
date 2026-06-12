import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ipcHandlers/scheduledTask', () => ({
  getCronJobService: vi.fn(),
}));

vi.mock('./libs/coworkOpenAICompatProxy', () => ({
  stopCoworkOpenAICompatProxy: vi.fn(),
}));

vi.mock('./libs/openclawTokenProxy', () => ({
  stopOpenClawTokenProxy: vi.fn(),
}));

vi.mock('./skillServices', () => ({
  getSkillServiceManager: vi.fn(),
}));

vi.mock('./trayManager', () => ({
  destroyTray: vi.fn(),
}));

import { getCronJobService } from './ipcHandlers/scheduledTask';
import { stopCoworkOpenAICompatProxy } from './libs/coworkOpenAICompatProxy';
import { stopOpenClawTokenProxy } from './libs/openclawTokenProxy';
import { createAppCleanupDeps } from './mainBootstrapAppCleanupSupport';
import { getSkillServiceManager } from './skillServices';
import { destroyTray } from './trayManager';

describe('mainBootstrapAppCleanupSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps cleanup deps and runs shutdown helpers against available runtime services', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stopWatching = vi.fn();
    const stopAllSessions = vi.fn();
    const stopFileActivity = vi.fn();
    const stopAllSkillServices = vi.fn().mockResolvedValue(undefined);
    const stopAllIMGateways = vi.fn().mockResolvedValue(undefined);
    const stopGateway = vi.fn().mockResolvedValue(undefined);
    const stopBridge = vi.fn();
    const stopPolling = vi.fn();
    const close = vi.fn();

    vi.mocked(getSkillServiceManager).mockReturnValue({
      stopAll: stopAllSkillServices,
    } as never);
    vi.mocked(getCronJobService).mockReturnValue({
      stopPolling,
    } as never);

    const runtime = {
      stopHermesIMSessionSyncPolling: vi.fn(),
      peekSkillManager: vi.fn().mockReturnValue({
        stopWatching,
      }),
      peekCoworkEngineRouter: vi.fn().mockReturnValue({
        stopAllSessions,
      }),
      peekCoworkRuntimeForwarder: vi.fn().mockReturnValue({
        stopFileActivity,
      }),
      peekIMGatewayManager: vi.fn().mockReturnValue({
        stopAll: stopAllIMGateways,
      }),
      peekOpenClawEngineManager: vi.fn().mockReturnValue({
        stopGateway,
      }),
      getMcpBridgeRuntime: vi.fn().mockReturnValue({
        stopBridge,
      }),
      getStore: vi.fn().mockReturnValue({
        close,
      }),
    };
    const state = {
      markQuitting: vi.fn(),
    };

    const deps = createAppCleanupDeps({ runtime, state } as never);

    expect(deps.markQuitting).toBe(state.markQuitting);
    expect(deps.shutdown.destroyTray).toBe(destroyTray);
    expect(deps.shutdown.stopHermesIMSessionSyncPolling).toBe(
      runtime.stopHermesIMSessionSyncPolling,
    );
    expect(deps.shutdown.stopCoworkOpenAICompatProxy).toBe(
      stopCoworkOpenAICompatProxy,
    );
    expect(deps.shutdown.stopOpenClawTokenProxy).toBe(stopOpenClawTokenProxy);

    deps.shutdown.stopSkillWatcher();
    expect(stopWatching).toHaveBeenCalledTimes(1);

    deps.shutdown.stopCoworkSessions();
    expect(stopAllSessions).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('[Main] Stopping cowork sessions...');

    deps.shutdown.stopCoworkFileActivity();
    expect(stopFileActivity).toHaveBeenCalledTimes(1);

    await deps.shutdown.stopSkillServices();
    expect(getSkillServiceManager).toHaveBeenCalledTimes(1);
    expect(stopAllSkillServices).toHaveBeenCalledTimes(1);

    await deps.shutdown.stopIMGateways();
    expect(stopAllIMGateways).toHaveBeenCalledTimes(1);

    await deps.shutdown.stopOpenClawGateway();
    expect(stopGateway).toHaveBeenCalledTimes(1);

    deps.shutdown.stopMcpBridge();
    expect(stopBridge).toHaveBeenCalledTimes(1);

    deps.shutdown.stopCronPolling();
    expect(stopPolling).toHaveBeenCalledTimes(1);

    deps.shutdown.closeStore();
    expect(close).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it('no-ops optional cleanup helpers when runtime services are unavailable', async () => {
    const stopAllSkillServices = vi.fn().mockResolvedValue(undefined);
    const stopPolling = vi.fn();
    const stopBridge = vi.fn();
    const close = vi.fn();

    vi.mocked(getSkillServiceManager).mockReturnValue({
      stopAll: stopAllSkillServices,
    } as never);
    vi.mocked(getCronJobService).mockReturnValue({
      stopPolling,
    } as never);

    const runtime = {
      stopHermesIMSessionSyncPolling: vi.fn(),
      peekSkillManager: vi.fn().mockReturnValue(null),
      peekCoworkEngineRouter: vi.fn().mockReturnValue(null),
      peekCoworkRuntimeForwarder: vi.fn().mockReturnValue(null),
      peekIMGatewayManager: vi.fn().mockReturnValue(null),
      peekOpenClawEngineManager: vi.fn().mockReturnValue(null),
      getMcpBridgeRuntime: vi.fn().mockReturnValue({
        stopBridge,
      }),
      getStore: vi.fn().mockReturnValue({
        close,
      }),
    };

    const deps = createAppCleanupDeps({
      runtime,
      state: { markQuitting: vi.fn() },
    } as never);

    expect(() => deps.shutdown.stopSkillWatcher()).not.toThrow();
    expect(() => deps.shutdown.stopCoworkSessions()).not.toThrow();
    expect(() => deps.shutdown.stopCoworkFileActivity()).not.toThrow();
    await expect(deps.shutdown.stopIMGateways()).resolves.toBeUndefined();
    await expect(deps.shutdown.stopOpenClawGateway()).resolves.toBeUndefined();

    await deps.shutdown.stopSkillServices();
    expect(stopAllSkillServices).toHaveBeenCalledTimes(1);

    deps.shutdown.stopMcpBridge();
    deps.shutdown.stopCronPolling();
    deps.shutdown.closeStore();
    expect(stopBridge).toHaveBeenCalledTimes(1);
    expect(stopPolling).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
