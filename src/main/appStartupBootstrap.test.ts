import { describe, expect, it, vi } from 'vitest';

vi.mock('./coreAppStartupBootstrap', () => ({
  bootstrapCoreAppStartup: vi.fn(),
}));

vi.mock('./authRuntimeBootstrap', () => ({
  bootstrapAuthRuntime: vi.fn(),
}));

vi.mock('./enterpriseStartupBootstrap', () => ({
  bootstrapEnterpriseStartup: vi.fn(),
}));

vi.mock('./runtimeSkillStartupBootstrap', () => ({
  bootstrapRuntimeSkillStartup: vi.fn(),
}));

vi.mock('./mainWindowSecurity', () => ({
  configureContentSecurityPolicy: vi.fn(),
}));

vi.mock('./appPostStartupLifecycle', () => ({
  registerAppPostStartupLifecycle: vi.fn(),
}));

import { registerAppPostStartupLifecycle } from './appPostStartupLifecycle';
import { bootstrapAppStartup } from './appStartupBootstrap';
import { bootstrapAuthRuntime } from './authRuntimeBootstrap';
import { bootstrapCoreAppStartup } from './coreAppStartupBootstrap';
import { bootstrapEnterpriseStartup } from './enterpriseStartupBootstrap';
import { configureContentSecurityPolicy } from './mainWindowSecurity';
import { bootstrapRuntimeSkillStartup } from './runtimeSkillStartupBootstrap';

describe('appStartupBootstrap', () => {
  it('runs startup stages in order and wires post-startup lifecycle deps', async () => {
    const store = { name: 'store' };
    vi.mocked(bootstrapCoreAppStartup).mockResolvedValue(store as never);
    vi.mocked(bootstrapAuthRuntime).mockResolvedValue(undefined);
    vi.mocked(bootstrapRuntimeSkillStartup).mockResolvedValue(undefined);

    const setStore = vi.fn();
    const createWindow = vi.fn();
    const setPendingAuthCode = vi.fn();
    const getStore = vi.fn(() => store as never);

    const deps = {
      app: { whenReady: vi.fn().mockResolvedValue(undefined) },
      isDev: true,
      initStore: vi.fn(),
      setStore,
      getStore,
      getCoworkStore: vi.fn(),
      getRuntimeTelemetryStore: vi.fn(),
      getServerApiBaseUrl: vi.fn(),
      getAuthTokens: vi.fn(),
      saveAuthTokens: vi.fn(),
      getPendingTokenRefresh: vi.fn(),
      setPendingTokenRefresh: vi.fn(),
      syncOpenClawConfig: vi.fn(),
      getIMGatewayManager: vi.fn(),
      getMcpStore: vi.fn(),
      bindCoworkRuntimeForwarder: vi.fn(),
      bindOpenClawStatusForwarder: vi.fn(),
      getHermesConfigSync: vi.fn(),
      resolveCoworkAgentEngine: vi.fn(),
      ensureOpenClawRunningForCowork: vi.fn(),
      getCronJobService: vi.fn(),
      getSkillManager: vi.fn(),
      getUseSystemProxyFromConfig: vi.fn(),
      applyProxyPreference: vi.fn(),
      processArgs: ['agora://auth/callback?code=demo'],
      getMainWindow: vi.fn(),
      createWindow,
      setPendingAuthCode,
      resolveFeishuIMAgentEngine: vi.fn(),
      hermesEngineValue: 'hermes',
      startHermesIMSessionSyncPolling: vi.fn(),
      syncHermesIMSessionsToCowork: vi.fn(),
      getOpenClawRuntimeAdapter: vi.fn(),
      setAutoLaunchEnabled: vi.fn(),
      getOpenClawEngineManager: vi.fn(),
      updateTitleBarOverlay: vi.fn(),
      setLanguage: vi.fn(),
      updateTrayMenu: vi.fn(),
    } as never;

    await bootstrapAppStartup(deps);

    expect(deps.app.whenReady).toHaveBeenCalled();
    expect(bootstrapCoreAppStartup).toHaveBeenCalled();
    expect(setStore).toHaveBeenCalledWith(store);
    expect(bootstrapAuthRuntime).toHaveBeenCalled();
    expect(bootstrapEnterpriseStartup).toHaveBeenCalledWith({
      store,
      getCoworkStore: deps.getCoworkStore,
      getIMGatewayManager: deps.getIMGatewayManager,
      getMcpStore: deps.getMcpStore,
    });
    expect(bootstrapRuntimeSkillStartup).toHaveBeenCalled();
    expect(configureContentSecurityPolicy).toHaveBeenCalledWith(true);
    expect(createWindow).toHaveBeenCalled();
    expect(registerAppPostStartupLifecycle).toHaveBeenCalled();
    const lifecycleDeps = vi.mocked(registerAppPostStartupLifecycle).mock.calls[0]?.[0];
    lifecycleDeps?.setPendingAuthCode('demo');
    expect(setPendingAuthCode).toHaveBeenCalledWith('demo');
  });
});
