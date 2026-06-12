import type { AllHandlerDeps } from './ipc';
import type { MainIpcRuntimeSessionBuilderDeps } from './mainIpcRuntimeContract';

export function createMainIpcRuntimeSessionHandlerDeps(
  deps: MainIpcRuntimeSessionBuilderDeps,
): AllHandlerDeps['sessions'] {
  return {
    getCoworkStore: deps.getCoworkStore,
    getCoworkEngineRouter: deps.getCoworkEngineRouter,
    getCoworkFileActivityTracker: deps.getCoworkFileActivityTracker,
    getCoworkPermissionManager: deps.getCoworkPermissionManager,
    getRuntimeTelemetryStore: deps.getRuntimeTelemetryStore,
    getIMGatewayManager: deps.getIMGatewayManager,
    getExternalAgentCliInstaller: deps.getExternalAgentCliInstaller,
    getExternalAgentProviderStore: deps.getExternalAgentProviderStore,
    getAgentTeamRunner: deps.getAgentTeamRunner,
    getStore: deps.getStore,
    getSkillManager: deps.getSkillManager,
    getConversationIngestor: deps.getConversationIngestor,
    resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
    resolveAgentRuntimeEngine: deps.resolveAgentRuntimeEngine,
    ensureCoworkEngineReady: deps.ensureCoworkEngineReady,
    getEngineNotReadyResponse: deps.getEngineNotReadyResponse,
    mergeCoworkSystemPrompt: deps.mergeCoworkSystemPrompt,
    applyExternalAgentConfigSourceForEngine:
      deps.applyExternalAgentConfigSourceForEngine,
    applyExternalAgentConfigForEngine: (engine, source) =>
      deps.applyExternalAgentConfigForEngine(engine, source),
    resolveSessionRuntimeSnapshot: deps.resolveSessionRuntimeSnapshot,
    prepareRuntimeSnapshotForTurn: deps.prepareRuntimeSnapshotForTurn,
    resolveTaskWorkingDirectory: deps.resolveTaskWorkingDirectory,
    getHermesConfigSync: deps.getHermesConfigSync,
    getHermesEngineManager: deps.getHermesEngineManager,
    getOpenClawEngineManager: deps.getOpenClawEngineManager,
    syncOpenClawConfig: deps.syncOpenClawConfig,
    syncOpenCodeGlobalConfigFromAgoraModel:
      deps.syncOpenCodeGlobalConfigFromAgoraModel,
    syncDeepSeekTuiGlobalConfigFromAgoraModel:
      deps.syncDeepSeekTuiGlobalConfigFromAgoraModel,
    importLocalAgentConfigToModelSettings: (store, appType) => {
      const result = deps.importLocalAgentConfigToModelSettings(
        store,
        appType,
      );
      return {
        success: result.success,
        imported: Boolean(result.imported),
        error: result.error,
      };
    },
    isExternalAgentProviderAppType: deps.isExternalAgentProviderAppType,
    bindExternalAgentCliInstallerForwarder:
      deps.bindExternalAgentCliInstallerForwarder,
    bindHermesStatusForwarder: deps.bindHermesStatusForwarder,
    bindOpenClawStatusForwarder: deps.bindOpenClawStatusForwarder,
    getMergedExternalAgentEnvironmentSnapshot:
      deps.getMergedExternalAgentEnvironmentSnapshot,
    resolveMemoryFilePath: deps.resolveMemoryFilePath,
    readMemoryEntries: deps.readMemoryEntries,
    searchMemoryEntries: deps.searchMemoryEntries,
    addMemoryEntry: deps.addMemoryEntry,
    updateMemoryEntry: deps.updateMemoryEntry,
    deleteMemoryEntry: deps.deleteMemoryEntry,
    migrateSqliteToMemoryMd: deps.migrateSqliteToMemoryMd,
    syncMemoryFileOnWorkspaceChange: deps.syncMemoryFileOnWorkspaceChange,
    ensureDefaultIdentity: deps.ensureDefaultIdentity,
    readBootstrapFile: deps.readBootstrapFile,
    writeBootstrapFile: deps.writeBootstrapFile,
    broadcastCoworkMessage: deps.broadcastCoworkMessage,
    broadcastCoworkError: deps.broadcastCoworkError,
    ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
    ensureOpenClawRunningForCowork: async () => {
      await deps.ensureOpenClawRunningForCowork();
    },
    startHermesIMSessionSyncPolling: deps.startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork: deps.syncHermesIMSessionsToCowork,
    stopHermesIMSessionSyncPolling: deps.stopHermesIMSessionSyncPolling,
    isFeishuEngineManagedByAgora: (key) =>
      deps.isFeishuEngineManagedByAgora(key),
    refreshEndpointsTestMode: deps.refreshEndpointsTestMode,
  };
}
