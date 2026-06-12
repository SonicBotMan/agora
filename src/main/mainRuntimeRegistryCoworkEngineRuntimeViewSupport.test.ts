import { describe, expect, it, vi } from 'vitest';

import { createMainRuntimeRegistryCoworkEngineRuntimeView } from './mainRuntimeRegistryCoworkEngineRuntimeViewSupport';

describe('mainRuntimeRegistryCoworkEngineRuntimeViewSupport', () => {
  it('exposes peek/get helpers and avoids unnecessary runtime creation for null pending token resets', async () => {
    const runtime = {
      peekOpenClawEngineManager: vi.fn().mockReturnValue('openclaw-manager'),
      peekHermesEngineManager: vi.fn().mockReturnValue('hermes-manager'),
      getPendingTokenRefresh: vi.fn().mockReturnValue('pending-refresh'),
      setPendingTokenRefresh: vi.fn(),
      getOpenClawEngineManager: vi.fn().mockReturnValue('openclaw-manager'),
      getHermesEngineManager: vi.fn().mockReturnValue('hermes-manager'),
      bindOpenClawStatusForwarder: vi.fn(),
      bindHermesStatusForwarder: vi.fn(),
      getHermesConfigSync: vi.fn().mockReturnValue('hermes-config-sync'),
      bootstrapHermesEngine: vi.fn().mockResolvedValue('bootstrapped'),
      ensureOpenClawRunningForCowork: vi.fn().mockResolvedValue('openclaw-ready'),
      ensureHermesRunningForCowork: vi.fn().mockResolvedValue('hermes-ready'),
      detectLocalOpenClawFeishu: vi.fn().mockReturnValue({ configured: true }),
      hasLocalOpenClawFeishuConfigured: vi.fn().mockReturnValue(true),
      syncHermesIMSessionsToCowork: vi.fn().mockResolvedValue(undefined),
      startHermesIMSessionSyncPolling: vi.fn(),
      stopHermesIMSessionSyncPolling: vi.fn(),
      getOpenClawConfigSync: vi.fn().mockReturnValue('openclaw-config-sync'),
      syncOpenClawConfig: vi.fn().mockResolvedValue({
        success: true,
        changed: false,
      }),
    };
    let activeRuntime: typeof runtime | null = null;
    const getCoworkEngineRuntime = vi.fn(() => {
      if (!activeRuntime) {
        activeRuntime = runtime;
      }
      return activeRuntime;
    });
    const peekCoworkEngineRuntime = vi.fn(() => activeRuntime);

    const view = createMainRuntimeRegistryCoworkEngineRuntimeView(
      getCoworkEngineRuntime as never,
      peekCoworkEngineRuntime as never,
    );

    expect(view.peekOpenClawEngineManager()).toBeNull();
    expect(view.peekHermesEngineManager()).toBeNull();
    expect(view.getPendingTokenRefresh()).toBeNull();

    view.setPendingTokenRefresh(null);
    expect(getCoworkEngineRuntime).not.toHaveBeenCalled();

    const pendingPromise = Promise.resolve('token');
    view.setPendingTokenRefresh(pendingPromise);
    expect(getCoworkEngineRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.setPendingTokenRefresh).toHaveBeenCalledWith(pendingPromise);

    expect(view.peekOpenClawEngineManager()).toBe('openclaw-manager');
    expect(view.peekHermesEngineManager()).toBe('hermes-manager');
    expect(view.getPendingTokenRefresh()).toBe('pending-refresh');
    expect(view.getOpenClawEngineManager()).toBe('openclaw-manager');
    expect(view.getHermesEngineManager()).toBe('hermes-manager');

    view.bindOpenClawStatusForwarder();
    view.bindHermesStatusForwarder();
    expect(view.getHermesConfigSync()).toBe('hermes-config-sync');
    await expect(view.bootstrapHermesEngine({ reason: 'manual' })).resolves.toBe(
      'bootstrapped',
    );
    await expect(view.ensureOpenClawRunningForCowork()).resolves.toBe(
      'openclaw-ready',
    );
    await expect(view.ensureHermesRunningForCowork()).resolves.toBe(
      'hermes-ready',
    );
    expect(view.detectLocalOpenClawFeishu()).toEqual({ configured: true });
    expect(view.hasLocalOpenClawFeishuConfigured()).toBe(true);
    await expect(
      view.syncHermesIMSessionsToCowork('gateway-ready'),
    ).resolves.toBeUndefined();
    view.startHermesIMSessionSyncPolling();
    view.stopHermesIMSessionSyncPolling();
    expect(view.getOpenClawConfigSync()).toBe('openclaw-config-sync');
    await expect(
      view.syncOpenClawConfig({ reason: 'manual' }),
    ).resolves.toEqual({
      success: true,
      changed: false,
    });
    await expect(view.syncOpenClawConfig()).resolves.toEqual({
      success: true,
      changed: false,
    });

    expect(runtime.bindOpenClawStatusForwarder).toHaveBeenCalledTimes(1);
    expect(runtime.bindHermesStatusForwarder).toHaveBeenCalledTimes(1);
    expect(runtime.bootstrapHermesEngine).toHaveBeenCalledWith({
      reason: 'manual',
    });
    expect(runtime.syncHermesIMSessionsToCowork).toHaveBeenCalledWith(
      'gateway-ready',
    );
    expect(runtime.syncOpenClawConfig).toHaveBeenNthCalledWith(1, {
      reason: 'manual',
    });
    expect(runtime.syncOpenClawConfig).toHaveBeenNthCalledWith(2, {
      reason: 'unknown',
    });
  });
});
