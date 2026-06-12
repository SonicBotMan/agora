import type { AppPostStartupLifecycleDeps } from './appPostStartupLifecycleContract';
import {
  applyColdStartDeepLink,
  applyInitialAppPreferences,
  registerAppActivateLifecycle,
  registerAppConfigLifecycle,
  registerResumeLifecycle,
  startEnabledIMGateways,
} from './appPostStartupLifecycleEventSupport';

export type { AppPostStartupLifecycleDeps } from './appPostStartupLifecycleContract';

export function registerAppPostStartupLifecycle(
  deps: AppPostStartupLifecycleDeps,
): void {
  applyColdStartDeepLink(deps.processArgs, deps.setPendingAuthCode);
  startEnabledIMGateways({
    getIMGatewayManager: deps.getIMGatewayManager,
    resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    hermesEngineValue: deps.hermesEngineValue,
    startHermesIMSessionSyncPolling: deps.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: deps.syncHermesIMSessionsToCowork,
  });
  registerResumeLifecycle(deps.getOpenClawRuntimeAdapter);

  const store = deps.getStore();
  applyInitialAppPreferences(store, deps.setAutoLaunchEnabled);
  registerAppConfigLifecycle(
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
  registerAppActivateLifecycle(deps.getMainWindow, deps.createWindow);
}
