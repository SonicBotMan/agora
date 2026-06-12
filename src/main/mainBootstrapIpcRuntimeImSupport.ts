import { approvePairingCode, listPairingRequests, readAllowFromStore, rejectPairingRequest } from './im/imPairingStore';
import { getFeishuRuntimeOwnershipStatus, transferFeishuToAgoraRuntime, transferFeishuToLocalRuntime } from './libs/feishuLocalRuntimeManager';
import { importOpenClawLocalFeishuConfig } from './libs/openclawSystemRuntime';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { MainIpcRuntimeImBuilderDeps } from './mainIpcRuntimeContract';

export function createMainIpcRuntimeImBuilderDeps(
  deps: MainBootstrapWiringDeps,
): MainIpcRuntimeImBuilderDeps {
  const { runtime } = deps;

  return {
    getStore: runtime.getStore,
    getCoworkStore: runtime.getCoworkStore,
    getIMGatewayManager: runtime.getIMGatewayManager,
    getOpenClawEngineManager: runtime.getOpenClawEngineManager,
    getHermesEngineManager: runtime.getHermesEngineManager,
    getOpenClawConfigSync: runtime.getOpenClawConfigSync,
    getHermesConfigSync: runtime.getHermesConfigSync,
    openClawRuntimeAdapter: runtime.peekOpenClawRuntimeAdapter(),
    syncOpenClawConfig: runtime.syncOpenClawConfig,
    resolveFeishuIMAgentEngine: runtime.resolveFeishuIMAgentEngine,
    isFeishuEngineManagedByAgora: runtime.isFeishuEngineManagedByAgora,
    normalizeFeishuEngineKey: runtime.normalizeFeishuEngineKey,
    getFeishuRuntimeOwnership: runtime.getFeishuRuntimeOwnership,
    getFeishuRuntimeOwnershipStatus,
    transferFeishuToLocalRuntime,
    transferFeishuToAgoraRuntime,
    detectLocalOpenClawFeishu: runtime.detectLocalOpenClawFeishu,
    importOpenClawLocalFeishuConfig,
    listPairingRequests,
    readAllowFromStore,
    approvePairingCode,
    rejectPairingRequest,
    startHermesIMSessionSyncPolling: runtime.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: runtime.syncHermesIMSessionsToCowork,
  };
}
