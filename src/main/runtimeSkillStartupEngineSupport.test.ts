import { describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';
import {
  bootstrapRuntimeEngineSync,
  finalizeRuntimeProxyStartup,
  startOpenClawRuntimeIfNeeded,
} from './runtimeSkillStartupEngineSupport';

describe('runtimeSkillStartupEngineSupport', () => {
  it('binds runtime forwarders and performs startup syncs', async () => {
    const bindCoworkRuntimeForwarder = vi.fn();
    const bindOpenClawStatusForwarder = vi.fn();
    const syncOpenClawConfig = vi.fn().mockResolvedValue({ success: true });
    const hermesSync = vi.fn().mockReturnValue({ success: true });

    await bootstrapRuntimeEngineSync({
      bindCoworkRuntimeForwarder,
      bindOpenClawStatusForwarder,
      syncOpenClawConfig,
      getHermesConfigSync: () => ({ sync: hermesSync }),
    });

    expect(bindCoworkRuntimeForwarder).toHaveBeenCalled();
    expect(bindOpenClawStatusForwarder).toHaveBeenCalled();
    expect(syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'startup',
      restartGatewayIfRunning: false,
    });
    expect(hermesSync).toHaveBeenCalledWith('startup');
  });

  it('starts openclaw runtime and cron polling only for openclaw engine', async () => {
    const startPolling = vi.fn();
    const ensureOpenClawRunningForCowork = vi.fn().mockResolvedValue(undefined);

    startOpenClawRuntimeIfNeeded({
      resolveCoworkAgentEngine: () => CoworkAgentEngine.OpenClaw,
      ensureOpenClawRunningForCowork,
      getCronJobService: () => ({ startPolling }),
    });

    await Promise.resolve();

    expect(ensureOpenClawRunningForCowork).toHaveBeenCalled();
    expect(startPolling).toHaveBeenCalled();
  });

  it('applies proxy preference and resyncs openclaw after proxy startup', async () => {
    const applyProxyPreference = vi.fn().mockResolvedValue(undefined);
    const startCoworkOpenAICompatProxy = vi.fn().mockResolvedValue(undefined);
    const syncOpenClawConfig = vi
      .fn()
      .mockResolvedValueOnce({ success: true, changed: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await finalizeRuntimeProxyStartup({
      store: {
        get: vi.fn().mockReturnValue({ useSystemProxy: true }),
      } as never,
      getUseSystemProxyFromConfig: (config) => config?.useSystemProxy === true,
      applyProxyPreference,
      resolveCoworkAgentEngine: () => CoworkAgentEngine.OpenClaw,
      syncOpenClawConfig,
      startCoworkOpenAICompatProxy,
    });

    expect(applyProxyPreference).toHaveBeenCalledWith(true);
    expect(startCoworkOpenAICompatProxy).toHaveBeenCalled();
    expect(syncOpenClawConfig).toHaveBeenCalledWith({ reason: 'proxy-ready' });

    logSpy.mockRestore();
  });
});
