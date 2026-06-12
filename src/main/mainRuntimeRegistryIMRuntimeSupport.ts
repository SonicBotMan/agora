import type { BrowserWindow } from 'electron';

import {
  createIMGatewayRuntime,
  type IMGatewayRuntime,
} from './imGatewayRuntime';
import { getCronJobService } from './ipcHandlers/scheduledTask';
import { getFeishuRuntimeOwnershipStatus } from './libs/feishuLocalRuntimeManager';
import type { MainRuntimeRegistryCoworkRuntimeSupport } from './mainRuntimeRegistryCoworkRuntimeSupport';
import {
  createScheduledTaskIMGatewayManagerView,
  type MainRuntimeRegistrySupport,
} from './mainRuntimeRegistrySupport';

export interface MainRuntimeRegistryIMRuntimeSupportDeps {
  getWindows: () => BrowserWindow[];
  getStore: MainRuntimeRegistrySupport['getStore'];
  getCoworkStore: MainRuntimeRegistrySupport['getCoworkStore'];
  getSkillManager: MainRuntimeRegistrySupport['getSkillManager'];
  getCoworkEngineRouter: MainRuntimeRegistryCoworkRuntimeSupport['getCoworkEngineRouter'];
  getAgentTeamRunner: MainRuntimeRegistryCoworkRuntimeSupport['getAgentTeamRunner'];
  resolveCoworkAgentEngine: MainRuntimeRegistryCoworkRuntimeSupport['resolveCoworkAgentEngine'];
  ensureOpenClawRunningForCowork: MainRuntimeRegistryCoworkRuntimeSupport['ensureOpenClawRunningForCowork'];
  ensureHermesRunningForCowork: MainRuntimeRegistryCoworkRuntimeSupport['ensureHermesRunningForCowork'];
  detectLocalOpenClawFeishu: MainRuntimeRegistryCoworkRuntimeSupport['detectLocalOpenClawFeishu'];
  hasLocalOpenClawFeishuConfigured: MainRuntimeRegistryCoworkRuntimeSupport['hasLocalOpenClawFeishuConfigured'];
  syncOpenClawConfig: MainRuntimeRegistryCoworkRuntimeSupport['syncOpenClawConfig'];
  getHermesConfigSync: MainRuntimeRegistryCoworkRuntimeSupport['getHermesConfigSync'];
  peekOpenClawRuntimeAdapter: MainRuntimeRegistryCoworkRuntimeSupport['peekOpenClawRuntimeAdapter'];
  startHermesIMSessionSyncPolling: MainRuntimeRegistryCoworkRuntimeSupport['startHermesIMSessionSyncPolling'];
  syncHermesIMSessionsToCowork: MainRuntimeRegistryCoworkRuntimeSupport['syncHermesIMSessionsToCowork'];
}

export interface MainRuntimeRegistryIMRuntimeSupport {
  peekIMGatewayManager: IMGatewayRuntime['peekIMGatewayManager'];
  getIMGatewayManager: IMGatewayRuntime['getIMGatewayManager'];
  getScheduledTaskIMGatewayManager: () => ReturnType<
    typeof createScheduledTaskIMGatewayManagerView
  >;
  resolveFeishuIMAgentEngine: IMGatewayRuntime['resolveFeishuIMAgentEngine'];
  normalizeFeishuEngineKey: IMGatewayRuntime['normalizeFeishuEngineKey'];
  getFeishuRuntimeOwnership: IMGatewayRuntime['getFeishuRuntimeOwnership'];
  isFeishuEngineManagedByAgora: IMGatewayRuntime['isFeishuEngineManagedByAgora'];
}

export function createMainRuntimeRegistryIMRuntimeSupport(
  deps: MainRuntimeRegistryIMRuntimeSupportDeps,
): MainRuntimeRegistryIMRuntimeSupport {
  let imGatewayRuntime: IMGatewayRuntime | null = null;

  const getIMGatewayRuntime = (): IMGatewayRuntime => {
    if (!imGatewayRuntime) {
      imGatewayRuntime = createIMGatewayRuntime({
        getWindows: deps.getWindows,
        getStore: deps.getStore,
        getCoworkStore: deps.getCoworkStore,
        getCoworkEngineRouter: deps.getCoworkEngineRouter,
        getSkillManager: deps.getSkillManager,
        getAgentTeamRunner: deps.getAgentTeamRunner,
        getCronJobService,
        resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
        ensureOpenClawRunningForCowork: deps.ensureOpenClawRunningForCowork,
        ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
        getFeishuRuntimeOwnershipStatus,
        detectLocalOpenClawFeishu: deps.detectLocalOpenClawFeishu,
        hasLocalOpenClawFeishuConfigured: deps.hasLocalOpenClawFeishuConfigured,
        syncOpenClawConfig: deps.syncOpenClawConfig,
        getHermesConfigSync: deps.getHermesConfigSync,
        peekOpenClawRuntimeAdapter: deps.peekOpenClawRuntimeAdapter,
        startHermesIMSessionSyncPolling: deps.startHermesIMSessionSyncPolling,
        syncHermesIMSessionsToCowork: deps.syncHermesIMSessionsToCowork,
      });
    }
    return imGatewayRuntime;
  };

  const getIMGatewayManager = () =>
    getIMGatewayRuntime().getIMGatewayManager();

  return {
    peekIMGatewayManager: () => imGatewayRuntime?.peekIMGatewayManager() ?? null,
    getIMGatewayManager,
    getScheduledTaskIMGatewayManager: () =>
      createScheduledTaskIMGatewayManagerView(getIMGatewayManager()),
    resolveFeishuIMAgentEngine: () =>
      getIMGatewayRuntime().resolveFeishuIMAgentEngine(),
    normalizeFeishuEngineKey: (value) =>
      getIMGatewayRuntime().normalizeFeishuEngineKey(value),
    getFeishuRuntimeOwnership: (engineKey) =>
      getIMGatewayRuntime().getFeishuRuntimeOwnership(engineKey),
    isFeishuEngineManagedByAgora: (engineKey) =>
      getIMGatewayRuntime().isFeishuEngineManagedByAgora(engineKey),
  };
}
