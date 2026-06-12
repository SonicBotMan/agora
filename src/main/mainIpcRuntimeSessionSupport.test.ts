import { describe, expect, it, vi } from 'vitest';

import { createMainIpcRuntimeSessionHandlerDeps } from './mainIpcRuntimeSessionSupport';

function createDeps() {
  return {
    getCoworkStore: vi.fn(),
    getCoworkEngineRouter: vi.fn(),
    getCoworkFileActivityTracker: vi.fn(),
    getCoworkPermissionManager: vi.fn(),
    getRuntimeTelemetryStore: vi.fn(),
    getIMGatewayManager: vi.fn(),
    getExternalAgentCliInstaller: vi.fn(),
    getExternalAgentProviderStore: vi.fn(),
    getAgentTeamRunner: vi.fn(),
    getStore: vi.fn(),
    getSkillManager: vi.fn(),
    getConversationIngestor: vi.fn(),
    resolveCoworkAgentEngine: vi.fn(),
    resolveAgentRuntimeEngine: vi.fn(),
    ensureCoworkEngineReady: vi.fn(),
    getEngineNotReadyResponse: vi.fn(),
    mergeCoworkSystemPrompt: vi.fn(),
    applyExternalAgentConfigSourceForEngine: vi.fn(),
    applyExternalAgentConfigForEngine: vi.fn(),
    resolveSessionRuntimeSnapshot: vi.fn(),
    prepareRuntimeSnapshotForTurn: vi.fn(),
    resolveTaskWorkingDirectory: vi.fn(),
    getHermesConfigSync: vi.fn(),
    getHermesEngineManager: vi.fn(),
    getOpenClawEngineManager: vi.fn(),
    syncOpenClawConfig: vi.fn(),
    syncOpenCodeGlobalConfigFromAgoraModel: vi.fn(),
    syncDeepSeekTuiGlobalConfigFromAgoraModel: vi.fn(),
    importLocalAgentConfigToModelSettings: vi.fn().mockReturnValue({
      success: true,
      imported: 0,
    }),
    isExternalAgentProviderAppType: vi.fn(),
    bindExternalAgentCliInstallerForwarder: vi.fn(),
    bindHermesStatusForwarder: vi.fn(),
    bindOpenClawStatusForwarder: vi.fn(),
    getMergedExternalAgentEnvironmentSnapshot: vi.fn(),
    resolveMemoryFilePath: vi.fn(),
    readMemoryEntries: vi.fn(),
    searchMemoryEntries: vi.fn(),
    addMemoryEntry: vi.fn(),
    updateMemoryEntry: vi.fn(),
    deleteMemoryEntry: vi.fn(),
    migrateSqliteToMemoryMd: vi.fn(),
    syncMemoryFileOnWorkspaceChange: vi.fn(),
    ensureDefaultIdentity: vi.fn(),
    readBootstrapFile: vi.fn(),
    writeBootstrapFile: vi.fn(),
    broadcastCoworkMessage: vi.fn(),
    broadcastCoworkError: vi.fn(),
    ensureHermesRunningForCowork: vi.fn(),
    ensureOpenClawRunningForCowork: vi.fn().mockResolvedValue({ phase: 'running' }),
    startHermesIMSessionSyncPolling: vi.fn(),
    syncHermesIMSessionsToCowork: vi.fn(),
    stopHermesIMSessionSyncPolling: vi.fn(),
    isFeishuEngineManagedByAgora: vi.fn(),
    refreshEndpointsTestMode: vi.fn(),
  };
}

describe('mainIpcRuntimeSessionSupport', () => {
  it('builds session handler deps and normalizes wrapped helpers where needed', async () => {
    const deps = createDeps();
    const handlerDeps = createMainIpcRuntimeSessionHandlerDeps(deps as never);

    expect(handlerDeps.getCoworkStore).toBe(deps.getCoworkStore);
    expect(handlerDeps.getCoworkEngineRouter).toBe(deps.getCoworkEngineRouter);
    expect(handlerDeps.getCoworkFileActivityTracker).toBe(
      deps.getCoworkFileActivityTracker,
    );
    expect(handlerDeps.getCoworkPermissionManager).toBe(
      deps.getCoworkPermissionManager,
    );
    expect(handlerDeps.getRuntimeTelemetryStore).toBe(
      deps.getRuntimeTelemetryStore,
    );
    expect(handlerDeps.getIMGatewayManager).toBe(deps.getIMGatewayManager);
    expect(handlerDeps.getExternalAgentCliInstaller).toBe(
      deps.getExternalAgentCliInstaller,
    );
    expect(handlerDeps.getExternalAgentProviderStore).toBe(
      deps.getExternalAgentProviderStore,
    );
    expect(handlerDeps.getAgentTeamRunner).toBe(deps.getAgentTeamRunner);
    expect(handlerDeps.getStore).toBe(deps.getStore);
    expect(handlerDeps.getSkillManager).toBe(deps.getSkillManager);
    expect(handlerDeps.getConversationIngestor).toBe(
      deps.getConversationIngestor,
    );
    expect(handlerDeps.resolveCoworkAgentEngine).toBe(
      deps.resolveCoworkAgentEngine,
    );
    expect(handlerDeps.resolveAgentRuntimeEngine).toBe(
      deps.resolveAgentRuntimeEngine,
    );
    expect(handlerDeps.ensureCoworkEngineReady).toBe(
      deps.ensureCoworkEngineReady,
    );
    expect(handlerDeps.getEngineNotReadyResponse).toBe(
      deps.getEngineNotReadyResponse,
    );
    expect(handlerDeps.mergeCoworkSystemPrompt).toBe(
      deps.mergeCoworkSystemPrompt,
    );
    expect(handlerDeps.applyExternalAgentConfigSourceForEngine).toBe(
      deps.applyExternalAgentConfigSourceForEngine,
    );
    handlerDeps.applyExternalAgentConfigForEngine('codex' as never, 'local');
    expect(deps.applyExternalAgentConfigForEngine).toHaveBeenCalledWith(
      'codex',
      'local',
    );

    expect(handlerDeps.resolveSessionRuntimeSnapshot).toBe(
      deps.resolveSessionRuntimeSnapshot,
    );
    expect(handlerDeps.prepareRuntimeSnapshotForTurn).toBe(
      deps.prepareRuntimeSnapshotForTurn,
    );
    expect(handlerDeps.resolveTaskWorkingDirectory).toBe(
      deps.resolveTaskWorkingDirectory,
    );
    expect(handlerDeps.getHermesConfigSync).toBe(deps.getHermesConfigSync);
    expect(handlerDeps.getHermesEngineManager).toBe(
      deps.getHermesEngineManager,
    );
    expect(handlerDeps.getOpenClawEngineManager).toBe(
      deps.getOpenClawEngineManager,
    );
    expect(handlerDeps.syncOpenClawConfig).toBe(deps.syncOpenClawConfig);
    expect(handlerDeps.syncOpenCodeGlobalConfigFromAgoraModel).toBe(
      deps.syncOpenCodeGlobalConfigFromAgoraModel,
    );
    expect(handlerDeps.syncDeepSeekTuiGlobalConfigFromAgoraModel).toBe(
      deps.syncDeepSeekTuiGlobalConfigFromAgoraModel,
    );

    expect(
      handlerDeps.importLocalAgentConfigToModelSettings('store' as never, 'app'),
    ).toEqual({
      success: true,
      imported: false,
      error: undefined,
    });
    expect(deps.importLocalAgentConfigToModelSettings).toHaveBeenCalledWith(
      'store',
      'app',
    );

    expect(handlerDeps.isExternalAgentProviderAppType).toBe(
      deps.isExternalAgentProviderAppType,
    );
    expect(handlerDeps.bindExternalAgentCliInstallerForwarder).toBe(
      deps.bindExternalAgentCliInstallerForwarder,
    );
    expect(handlerDeps.bindHermesStatusForwarder).toBe(
      deps.bindHermesStatusForwarder,
    );
    expect(handlerDeps.bindOpenClawStatusForwarder).toBe(
      deps.bindOpenClawStatusForwarder,
    );
    expect(handlerDeps.getMergedExternalAgentEnvironmentSnapshot).toBe(
      deps.getMergedExternalAgentEnvironmentSnapshot,
    );
    expect(handlerDeps.resolveMemoryFilePath).toBe(deps.resolveMemoryFilePath);
    expect(handlerDeps.readMemoryEntries).toBe(deps.readMemoryEntries);
    expect(handlerDeps.searchMemoryEntries).toBe(deps.searchMemoryEntries);
    expect(handlerDeps.addMemoryEntry).toBe(deps.addMemoryEntry);
    expect(handlerDeps.updateMemoryEntry).toBe(deps.updateMemoryEntry);
    expect(handlerDeps.deleteMemoryEntry).toBe(deps.deleteMemoryEntry);
    expect(handlerDeps.migrateSqliteToMemoryMd).toBe(
      deps.migrateSqliteToMemoryMd,
    );
    expect(handlerDeps.syncMemoryFileOnWorkspaceChange).toBe(
      deps.syncMemoryFileOnWorkspaceChange,
    );
    expect(handlerDeps.ensureDefaultIdentity).toBe(deps.ensureDefaultIdentity);
    expect(handlerDeps.readBootstrapFile).toBe(deps.readBootstrapFile);
    expect(handlerDeps.writeBootstrapFile).toBe(deps.writeBootstrapFile);
    expect(handlerDeps.broadcastCoworkMessage).toBe(
      deps.broadcastCoworkMessage,
    );
    expect(handlerDeps.broadcastCoworkError).toBe(deps.broadcastCoworkError);
    expect(handlerDeps.ensureHermesRunningForCowork).toBe(
      deps.ensureHermesRunningForCowork,
    );
    await expect(handlerDeps.ensureOpenClawRunningForCowork()).resolves.toBeUndefined();
    expect(deps.ensureOpenClawRunningForCowork).toHaveBeenCalledTimes(1);
    expect(handlerDeps.startHermesIMSessionSyncPolling).toBe(
      deps.startHermesIMSessionSyncPolling,
    );
    expect(handlerDeps.syncHermesIMSessionsToCowork).toBe(
      deps.syncHermesIMSessionsToCowork,
    );
    expect(handlerDeps.stopHermesIMSessionSyncPolling).toBe(
      deps.stopHermesIMSessionSyncPolling,
    );
    expect(handlerDeps.isFeishuEngineManagedByAgora('codex')).toBeUndefined();
    expect(deps.isFeishuEngineManagedByAgora).toHaveBeenCalledWith('codex');
    expect(handlerDeps.refreshEndpointsTestMode).toBe(
      deps.refreshEndpointsTestMode,
    );
  });
});
