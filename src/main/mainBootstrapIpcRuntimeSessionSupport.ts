import { resolveTaskWorkingDirectory } from './core/ipcUtils';
import { refreshEndpointsTestMode } from './libs/endpoints';
import {
  applyExternalAgentConfigForEngine,
  syncDeepSeekTuiGlobalConfigFromAgoraModel,
  syncOpenCodeGlobalConfigFromAgoraModel,
} from './libs/externalAgentConfigSync';
import {
  addMemoryEntry,
  deleteMemoryEntry,
  ensureDefaultIdentity,
  migrateSqliteToMemoryMd,
  readBootstrapFile,
  readMemoryEntries,
  resolveMemoryFilePath,
  searchMemoryEntries,
  syncMemoryFileOnWorkspaceChange,
  updateMemoryEntry,
  writeBootstrapFile,
} from './libs/openclawMemoryFile';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { MainIpcRuntimeSessionBuilderDeps } from './mainIpcRuntimeContract';

export function createMainIpcRuntimeSessionBuilderDeps(
  deps: MainBootstrapWiringDeps,
  sessionSupport: Pick<
    MainIpcRuntimeSessionBuilderDeps,
    | 'getEngineNotReadyResponse'
    | 'mergeCoworkSystemPrompt'
    | 'importLocalAgentConfigToModelSettings'
    | 'isExternalAgentProviderAppType'
  >,
): MainIpcRuntimeSessionBuilderDeps {
  const { runtime } = deps;

  return {
    getCoworkStore: runtime.getCoworkStore,
    getCoworkEngineRouter: runtime.getCoworkEngineRouter,
    getCoworkFileActivityTracker: () =>
      runtime.getCoworkRuntimeForwarder().getFileActivityTracker(),
    getCoworkPermissionManager: () =>
      runtime.getCoworkRuntimeForwarder().getPermissionManager(),
    getRuntimeTelemetryStore: runtime.getRuntimeTelemetryStore,
    getIMGatewayManager: runtime.getIMGatewayManager,
    getExternalAgentCliInstaller: runtime.getExternalAgentCliInstaller,
    getExternalAgentProviderStore: runtime.getExternalAgentProviderStore,
    getAgentTeamRunner: runtime.getAgentTeamRunner,
    getStore: runtime.getStore,
    getSkillManager: runtime.getSkillManager,
    getConversationIngestor: runtime.getConversationIngestor,
    resolveCoworkAgentEngine: runtime.resolveCoworkAgentEngine,
    resolveAgentRuntimeEngine: runtime.resolveAgentRuntimeEngine,
    ensureCoworkEngineReady: runtime.ensureCoworkEngineReady,
    getEngineNotReadyResponse: sessionSupport.getEngineNotReadyResponse,
    mergeCoworkSystemPrompt: sessionSupport.mergeCoworkSystemPrompt,
    applyExternalAgentConfigSourceForEngine:
      runtime.applyExternalAgentConfigSourceForEngine,
    applyExternalAgentConfigForEngine,
    resolveSessionRuntimeSnapshot: runtime.resolveSessionRuntimeSnapshot,
    prepareRuntimeSnapshotForTurn: runtime.prepareRuntimeSnapshotForTurn,
    resolveTaskWorkingDirectory,
    getHermesConfigSync: runtime.getHermesConfigSync,
    getHermesEngineManager: runtime.getHermesEngineManager,
    getOpenClawEngineManager: runtime.getOpenClawEngineManager,
    syncOpenClawConfig: runtime.syncOpenClawConfig,
    syncOpenCodeGlobalConfigFromAgoraModel,
    syncDeepSeekTuiGlobalConfigFromAgoraModel,
    importLocalAgentConfigToModelSettings:
      sessionSupport.importLocalAgentConfigToModelSettings,
    isExternalAgentProviderAppType:
      sessionSupport.isExternalAgentProviderAppType,
    bindExternalAgentCliInstallerForwarder:
      runtime.bindExternalAgentCliInstallerForwarder,
    bindHermesStatusForwarder: runtime.bindHermesStatusForwarder,
    bindOpenClawStatusForwarder: runtime.bindOpenClawStatusForwarder,
    getMergedExternalAgentEnvironmentSnapshot:
      runtime.getMergedExternalAgentEnvironmentSnapshot,
    resolveMemoryFilePath,
    readMemoryEntries,
    searchMemoryEntries,
    addMemoryEntry,
    updateMemoryEntry,
    deleteMemoryEntry,
    migrateSqliteToMemoryMd,
    syncMemoryFileOnWorkspaceChange,
    ensureDefaultIdentity,
    readBootstrapFile,
    writeBootstrapFile,
    broadcastCoworkMessage: (sessionId, message) =>
      runtime.getCoworkRuntimeForwarder().broadcastMessage(sessionId, message),
    broadcastCoworkError: (sessionId, error) =>
      runtime.getCoworkRuntimeForwarder().broadcastError(sessionId, error),
    ensureHermesRunningForCowork: runtime.ensureHermesRunningForCowork,
    ensureOpenClawRunningForCowork: runtime.ensureOpenClawRunningForCowork,
    startHermesIMSessionSyncPolling: runtime.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: runtime.syncHermesIMSessionsToCowork,
    stopHermesIMSessionSyncPolling: runtime.stopHermesIMSessionSyncPolling,
    isFeishuEngineManagedByAgora: runtime.isFeishuEngineManagedByAgora,
    refreshEndpointsTestMode,
  };
}
