import { describe, expect, it, vi } from 'vitest';

vi.mock('./appPostStartupLifecycleEventSupport', () => ({
  applyColdStartDeepLink: vi.fn(),
  applyInitialAppPreferences: vi.fn(),
  registerAppActivateLifecycle: vi.fn(),
  registerAppConfigLifecycle: vi.fn(),
  registerResumeLifecycle: vi.fn(),
  startEnabledIMGateways: vi.fn(),
}));

import { registerAppPostStartupLifecycle } from './appPostStartupLifecycle';
import {
  applyColdStartDeepLink,
  applyInitialAppPreferences,
  registerAppActivateLifecycle,
  registerAppConfigLifecycle,
  registerResumeLifecycle,
  startEnabledIMGateways,
} from './appPostStartupLifecycleEventSupport';

describe('appPostStartupLifecycle', () => {
  it('orchestrates post-startup lifecycle registration with a shared store instance', () => {
    const store = { id: 'store' };
    const deps = {
      processArgs: ['--code', 'abc123'],
      getStore: vi.fn().mockReturnValue(store),
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

    registerAppPostStartupLifecycle(deps as never);

    expect(applyColdStartDeepLink).toHaveBeenCalledWith(
      deps.processArgs,
      deps.setPendingAuthCode,
    );
    expect(startEnabledIMGateways).toHaveBeenCalledWith({
      getIMGatewayManager: deps.getIMGatewayManager,
      resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
      hermesEngineValue: deps.hermesEngineValue,
      startHermesIMSessionSyncPolling: deps.startHermesIMSessionSyncPolling,
      syncHermesIMSessionsToCowork: deps.syncHermesIMSessionsToCowork,
    });
    expect(registerResumeLifecycle).toHaveBeenCalledWith(
      deps.getOpenClawRuntimeAdapter,
    );
    expect(deps.getStore).toHaveBeenCalledTimes(1);
    expect(applyInitialAppPreferences).toHaveBeenCalledWith(
      store,
      deps.setAutoLaunchEnabled,
    );
    expect(registerAppConfigLifecycle).toHaveBeenCalledWith(
      {
        getMainWindow: deps.getMainWindow,
        getUseSystemProxyFromConfig: deps.getUseSystemProxyFromConfig,
        applyProxyPreference: deps.applyProxyPreference,
        getOpenClawEngineManager: deps.getOpenClawEngineManager,
        updateTitleBarOverlay: deps.updateTitleBarOverlay,
        setLanguage: deps.setLanguage,
        updateTrayMenu: deps.updateTrayMenu,
      },
      store,
    );
    expect(registerAppActivateLifecycle).toHaveBeenCalledWith(
      deps.getMainWindow,
      deps.createWindow,
    );
  });
});
