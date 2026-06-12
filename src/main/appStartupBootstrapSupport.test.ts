import { describe, expect, it, vi } from 'vitest';

import {
  createAppPostStartupLifecycleDeps,
  createAuthRuntimeBootstrapDeps,
  createRuntimeSkillStartupDeps,
} from './appStartupBootstrapSupport';

describe('appStartupBootstrapSupport', () => {
  it('maps auth runtime bootstrap deps directly from app startup deps', () => {
    const deps = {
      getStore: vi.fn(),
      getServerApiBaseUrl: vi.fn(),
      getAuthTokens: vi.fn(),
      saveAuthTokens: vi.fn(),
      getPendingTokenRefresh: vi.fn(),
      setPendingTokenRefresh: vi.fn(),
      syncOpenClawConfig: vi.fn(),
    };

    const runtimeDeps = createAuthRuntimeBootstrapDeps(deps as never);

    expect(runtimeDeps).toEqual({
      getStore: deps.getStore,
      getServerApiBaseUrl: deps.getServerApiBaseUrl,
      getAuthTokens: deps.getAuthTokens,
      saveAuthTokens: deps.saveAuthTokens,
      getPendingTokenRefresh: deps.getPendingTokenRefresh,
      setPendingTokenRefresh: deps.setPendingTokenRefresh,
      syncOpenClawConfig: deps.syncOpenClawConfig,
    });
  });

  it('maps runtime skill startup deps and wraps ensureOpenClawRunningForCowork', async () => {
    const store = { id: 'store' };
    const deps = {
      getStore: vi.fn().mockReturnValue(store),
      bindCoworkRuntimeForwarder: vi.fn(),
      bindOpenClawStatusForwarder: vi.fn(),
      syncOpenClawConfig: vi.fn(),
      getHermesConfigSync: vi.fn(),
      resolveCoworkAgentEngine: vi.fn(),
      ensureOpenClawRunningForCowork: vi.fn().mockResolvedValue('started'),
      getCronJobService: vi.fn(),
      getSkillManager: vi.fn(),
      getUseSystemProxyFromConfig: vi.fn(),
      applyProxyPreference: vi.fn(),
    };

    const runtimeDeps = createRuntimeSkillStartupDeps(deps as never);

    expect(runtimeDeps.store).toBe(store);
    expect(deps.getStore).toHaveBeenCalledTimes(1);
    expect(runtimeDeps.bindCoworkRuntimeForwarder).toBe(
      deps.bindCoworkRuntimeForwarder,
    );
    expect(runtimeDeps.bindOpenClawStatusForwarder).toBe(
      deps.bindOpenClawStatusForwarder,
    );
    expect(runtimeDeps.syncOpenClawConfig).toBe(deps.syncOpenClawConfig);
    expect(runtimeDeps.getHermesConfigSync).toBe(deps.getHermesConfigSync);
    expect(runtimeDeps.resolveCoworkAgentEngine).toBe(
      deps.resolveCoworkAgentEngine,
    );
    expect(runtimeDeps.getCronJobService).toBe(deps.getCronJobService);
    expect(runtimeDeps.getSkillManager).toBe(deps.getSkillManager);
    expect(runtimeDeps.getUseSystemProxyFromConfig).toBe(
      deps.getUseSystemProxyFromConfig,
    );
    expect(runtimeDeps.applyProxyPreference).toBe(deps.applyProxyPreference);

    await runtimeDeps.ensureOpenClawRunningForCowork();
    expect(deps.ensureOpenClawRunningForCowork).toHaveBeenCalledTimes(1);
  });

  it('maps app post-startup deps and only forwards truthy pending auth codes', () => {
    const deps = {
      processArgs: ['--code', 'abc123'],
      getStore: vi.fn(),
      getMainWindow: vi.fn(),
      createWindow: vi.fn(),
      setPendingAuthCode: vi.fn(),
      getIMGatewayManager: vi.fn(),
      resolveFeishuIMAgentEngine: vi.fn(),
      hermesEngineValue: 'hermes',
      startHermesIMSessionSyncPolling: vi.fn(),
      syncHermesIMSessionsToCowork: vi.fn(),
      getOpenClawRuntimeAdapter: vi.fn(),
      setAutoLaunchEnabled: vi.fn(),
      getUseSystemProxyFromConfig: vi.fn(),
      applyProxyPreference: vi.fn(),
      getOpenClawEngineManager: vi.fn(),
      updateTitleBarOverlay: vi.fn(),
      setLanguage: vi.fn(),
      updateTrayMenu: vi.fn(),
    };

    const lifecycleDeps = createAppPostStartupLifecycleDeps(deps as never);

    expect(lifecycleDeps.processArgs).toBe(deps.processArgs);
    expect(lifecycleDeps.getStore).toBe(deps.getStore);
    expect(lifecycleDeps.getMainWindow).toBe(deps.getMainWindow);
    expect(lifecycleDeps.createWindow).toBe(deps.createWindow);
    expect(lifecycleDeps.getIMGatewayManager).toBe(deps.getIMGatewayManager);
    expect(lifecycleDeps.resolveFeishuIMAgentEngine).toBe(
      deps.resolveFeishuIMAgentEngine,
    );
    expect(lifecycleDeps.hermesEngineValue).toBe('hermes');
    expect(lifecycleDeps.startHermesIMSessionSyncPolling).toBe(
      deps.startHermesIMSessionSyncPolling,
    );
    expect(lifecycleDeps.syncHermesIMSessionsToCowork).toBe(
      deps.syncHermesIMSessionsToCowork,
    );
    expect(lifecycleDeps.getOpenClawRuntimeAdapter).toBe(
      deps.getOpenClawRuntimeAdapter,
    );
    expect(lifecycleDeps.setAutoLaunchEnabled).toBe(deps.setAutoLaunchEnabled);
    expect(lifecycleDeps.getUseSystemProxyFromConfig).toBe(
      deps.getUseSystemProxyFromConfig,
    );
    expect(lifecycleDeps.applyProxyPreference).toBe(
      deps.applyProxyPreference,
    );
    expect(lifecycleDeps.getOpenClawEngineManager).toBe(
      deps.getOpenClawEngineManager,
    );
    expect(lifecycleDeps.updateTitleBarOverlay).toBe(
      deps.updateTitleBarOverlay,
    );
    expect(lifecycleDeps.setLanguage).toBe(deps.setLanguage);
    expect(lifecycleDeps.updateTrayMenu).toBe(deps.updateTrayMenu);

    lifecycleDeps.setPendingAuthCode('next-code');
    lifecycleDeps.setPendingAuthCode('' as never);
    lifecycleDeps.setPendingAuthCode(null as never);
    expect(deps.setPendingAuthCode).toHaveBeenCalledTimes(1);
    expect(deps.setPendingAuthCode).toHaveBeenCalledWith('next-code');
  });
});
