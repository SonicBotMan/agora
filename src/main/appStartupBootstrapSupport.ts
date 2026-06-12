import type { AppPostStartupLifecycleDeps } from './appPostStartupLifecycle';
import type { AppStartupBootstrapDeps } from './appStartupBootstrapContract';
import type { AuthRuntimeBootstrapDeps } from './authRuntimeBootstrap';
import type { RuntimeSkillStartupBootstrapDeps } from './runtimeSkillStartupBootstrap';

export function createAuthRuntimeBootstrapDeps(
  deps: AppStartupBootstrapDeps,
): AuthRuntimeBootstrapDeps {
  return {
    getStore: deps.getStore,
    getServerApiBaseUrl: deps.getServerApiBaseUrl,
    getAuthTokens: deps.getAuthTokens,
    saveAuthTokens: deps.saveAuthTokens,
    getPendingTokenRefresh: deps.getPendingTokenRefresh,
    setPendingTokenRefresh: deps.setPendingTokenRefresh,
    syncOpenClawConfig: deps.syncOpenClawConfig,
  };
}

export function createRuntimeSkillStartupDeps(
  deps: AppStartupBootstrapDeps,
): RuntimeSkillStartupBootstrapDeps {
  return {
    store: deps.getStore(),
    bindCoworkRuntimeForwarder: deps.bindCoworkRuntimeForwarder,
    bindOpenClawStatusForwarder: deps.bindOpenClawStatusForwarder,
    syncOpenClawConfig: deps.syncOpenClawConfig,
    getHermesConfigSync: deps.getHermesConfigSync,
    resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
    ensureOpenClawRunningForCowork: async () => {
      await deps.ensureOpenClawRunningForCowork();
    },
    getCronJobService: deps.getCronJobService,
    getSkillManager: deps.getSkillManager,
    getUseSystemProxyFromConfig: deps.getUseSystemProxyFromConfig,
    applyProxyPreference: deps.applyProxyPreference,
  };
}

export function createAppPostStartupLifecycleDeps(
  deps: AppStartupBootstrapDeps,
): AppPostStartupLifecycleDeps {
  return {
    processArgs: deps.processArgs,
    getStore: deps.getStore,
    getMainWindow: deps.getMainWindow,
    createWindow: deps.createWindow,
    setPendingAuthCode: (code) => {
      if (code) {
        deps.setPendingAuthCode(code);
      }
    },
    getIMGatewayManager: deps.getIMGatewayManager,
    resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    hermesEngineValue: deps.hermesEngineValue,
    startHermesIMSessionSyncPolling: deps.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: deps.syncHermesIMSessionsToCowork,
    getOpenClawRuntimeAdapter: deps.getOpenClawRuntimeAdapter,
    setAutoLaunchEnabled: deps.setAutoLaunchEnabled,
    getUseSystemProxyFromConfig: deps.getUseSystemProxyFromConfig,
    applyProxyPreference: deps.applyProxyPreference,
    getOpenClawEngineManager: deps.getOpenClawEngineManager,
    updateTitleBarOverlay: deps.updateTitleBarOverlay,
    setLanguage: deps.setLanguage,
    updateTrayMenu: deps.updateTrayMenu,
  };
}
