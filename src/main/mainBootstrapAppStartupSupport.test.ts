import { describe, expect, it, vi } from 'vitest';

vi.mock('./libs/endpoints', () => ({
  getServerApiBaseUrl: vi.fn(),
}));

vi.mock('./ipcHandlers/scheduledTask', () => ({
  getCronJobService: vi.fn(),
}));

vi.mock('./autoLaunchManager', () => ({
  setAutoLaunchEnabled: vi.fn(),
}));

vi.mock('./i18n', () => ({
  setLanguage: vi.fn(),
}));

import { setAutoLaunchEnabled } from './autoLaunchManager';
import { setLanguage } from './i18n';
import { getCronJobService } from './ipcHandlers/scheduledTask';
import { getServerApiBaseUrl } from './libs/endpoints';
import { createAppStartupDeps } from './mainBootstrapAppStartupSupport';

describe('mainBootstrapAppStartupSupport', () => {
  it('maps runtime and window controller dependencies into app startup deps', () => {
    const mcpStore = { id: 'mcp-store' };
    const runtime = {
      initStore: vi.fn(),
      setStore: vi.fn(),
      getStore: vi.fn(),
      getCoworkStore: vi.fn(),
      getRuntimeTelemetryStore: vi.fn(),
      getPendingTokenRefresh: vi.fn(),
      setPendingTokenRefresh: vi.fn(),
      syncOpenClawConfig: vi.fn(),
      getIMGatewayManager: vi.fn(),
      getMcpBridgeRuntime: vi.fn().mockReturnValue({
        getMcpStore: () => mcpStore,
      }),
      getCoworkRuntimeForwarder: vi.fn().mockReturnValue({
        bind: vi.fn(),
      }),
      bindOpenClawStatusForwarder: vi.fn(),
      getHermesConfigSync: vi.fn(),
      resolveCoworkAgentEngine: vi.fn(),
      ensureOpenClawRunningForCowork: vi.fn(),
      getSkillManager: vi.fn(),
      resolveFeishuIMAgentEngine: vi.fn(),
      startHermesIMSessionSyncPolling: vi.fn(),
      syncHermesIMSessionsToCowork: vi.fn(),
      peekOpenClawRuntimeAdapter: vi.fn(),
      getOpenClawEngineManager: vi.fn(),
    };
    const windowController = {
      getUseSystemProxyFromConfig: vi.fn(),
      applyProxyPreference: vi.fn(),
      updateTitleBarOverlay: vi.fn(),
    };

    const deps = createAppStartupDeps({
      app: { name: 'app' },
      isDev: true,
      runtime,
      windowController,
    } as never);

    expect(deps.app).toEqual({ name: 'app' });
    expect(deps.isDev).toBe(true);
    expect(deps.getServerApiBaseUrl).toBe(getServerApiBaseUrl);
    expect(deps.getCronJobService).toBe(getCronJobService);
    expect(deps.setAutoLaunchEnabled).toBe(setAutoLaunchEnabled);
    expect(deps.setLanguage).toBe(setLanguage);
    expect(deps.getMcpStore()).toBe(mcpStore);
    expect(deps.getUseSystemProxyFromConfig).toBe(
      windowController.getUseSystemProxyFromConfig,
    );
    expect(deps.applyProxyPreference).toBe(
      windowController.applyProxyPreference,
    );
  });
});
