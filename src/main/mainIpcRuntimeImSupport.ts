import type { ImDeps } from './ipc';
import type { MainIpcRuntimeImBuilderDeps } from './mainIpcRuntimeContract';

export function createMainIpcRuntimeImHandlerDeps(
  deps: MainIpcRuntimeImBuilderDeps,
): ImDeps {
  return {
    getStore: () => deps.getStore(),
    getCoworkStore: deps.getCoworkStore,
    getIMGatewayManager: () =>
      deps.getIMGatewayManager() as ReturnType<ImDeps['getIMGatewayManager']>,
    getOpenClawEngineManager: deps.getOpenClawEngineManager,
    getHermesEngineManager: deps.getHermesEngineManager,
    getOpenClawConfigSync: deps.getOpenClawConfigSync,
    getHermesConfigSync: deps.getHermesConfigSync,
    openClawRuntimeAdapter: deps.openClawRuntimeAdapter,
    syncOpenClawConfig: async (options) => {
      const result = await deps.syncOpenClawConfig(options);
      return {
        ...result,
        changed: Boolean(result.changed),
      };
    },
    resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    isFeishuEngineManagedByAgora: (key) =>
      deps.isFeishuEngineManagedByAgora(key),
    normalizeFeishuEngineKey: (value) =>
      String(deps.normalizeFeishuEngineKey(value)),
    getFeishuRuntimeOwnership: (key) =>
      String(deps.getFeishuRuntimeOwnership(key)),
    getFeishuRuntimeOwnershipStatus: (key, ownership) =>
      deps.getFeishuRuntimeOwnershipStatus(key, ownership),
    transferFeishuToLocalRuntime: (engineKey, instances, engineManagers) =>
      deps.transferFeishuToLocalRuntime(
        engineKey,
        instances,
        engineManagers,
      ) as ReturnType<ImDeps['transferFeishuToLocalRuntime']>,
    transferFeishuToAgoraRuntime: (engineKey) =>
      deps.transferFeishuToAgoraRuntime(
        engineKey,
      ) as ReturnType<ImDeps['transferFeishuToAgoraRuntime']>,
    detectLocalOpenClawFeishu: () =>
      deps.detectLocalOpenClawFeishu() as ReturnType<
        ImDeps['detectLocalOpenClawFeishu']
      >,
    importOpenClawLocalFeishuConfig: () =>
      deps.importOpenClawLocalFeishuConfig() as ReturnType<
        ImDeps['importOpenClawLocalFeishuConfig']
      >,
    listPairingRequests: (platform, stateDir) =>
      deps.listPairingRequests(
        platform,
        stateDir,
      ) as ReturnType<ImDeps['listPairingRequests']>,
    readAllowFromStore: (platform, stateDir) =>
      deps.readAllowFromStore(
        platform,
        stateDir,
      ) as ReturnType<ImDeps['readAllowFromStore']>,
    approvePairingCode: (platform, code, stateDir) =>
      Boolean(deps.approvePairingCode(platform, code, stateDir)),
    rejectPairingRequest: (platform, code, stateDir) =>
      Boolean(deps.rejectPairingRequest(platform, code, stateDir)),
    startHermesIMSessionSyncPolling: deps.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: deps.syncHermesIMSessionsToCowork,
  };
}
