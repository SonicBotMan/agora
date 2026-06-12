import { CoworkAgentEngine as CoworkAgentEngineValue } from '../shared/cowork/constants';
import { setAutoLaunchEnabled } from './autoLaunchManager';
import { setLanguage } from './i18n';
import { getCronJobService } from './ipcHandlers/scheduledTask';
import { getServerApiBaseUrl } from './libs/endpoints';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrap';
import { updateTrayMenu } from './trayManager';

export function createAppStartupDeps(
  deps: MainBootstrapWiringDeps,
): SingleInstanceAppBootstrapDeps['appStartup'] {
  const { runtime, windowController } = deps;

  return {
    app: deps.app,
    isDev: deps.isDev,
    initStore: runtime.initStore,
    setStore: runtime.setStore,
    getStore: runtime.getStore,
    getCoworkStore: runtime.getCoworkStore,
    getRuntimeTelemetryStore: runtime.getRuntimeTelemetryStore,
    getServerApiBaseUrl,
    getPendingTokenRefresh: runtime.getPendingTokenRefresh,
    setPendingTokenRefresh: runtime.setPendingTokenRefresh,
    syncOpenClawConfig: runtime.syncOpenClawConfig,
    getIMGatewayManager: runtime.getIMGatewayManager,
    getMcpStore: () => runtime.getMcpBridgeRuntime().getMcpStore(),
    bindCoworkRuntimeForwarder: () => runtime.getCoworkRuntimeForwarder().bind(),
    bindOpenClawStatusForwarder: runtime.bindOpenClawStatusForwarder,
    getHermesConfigSync: runtime.getHermesConfigSync,
    resolveCoworkAgentEngine: runtime.resolveCoworkAgentEngine,
    ensureOpenClawRunningForCowork: runtime.ensureOpenClawRunningForCowork,
    getCronJobService,
    getSkillManager: runtime.getSkillManager,
    getUseSystemProxyFromConfig: windowController.getUseSystemProxyFromConfig,
    applyProxyPreference: windowController.applyProxyPreference,
    processArgs: process.argv,
    resolveFeishuIMAgentEngine: runtime.resolveFeishuIMAgentEngine,
    hermesEngineValue: CoworkAgentEngineValue.Hermes,
    startHermesIMSessionSyncPolling: runtime.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: runtime.syncHermesIMSessionsToCowork,
    getOpenClawRuntimeAdapter: () => runtime.peekOpenClawRuntimeAdapter(),
    setAutoLaunchEnabled,
    getOpenClawEngineManager: runtime.getOpenClawEngineManager,
    updateTitleBarOverlay: windowController.updateTitleBarOverlay,
    setLanguage,
    updateTrayMenu,
  };
}
