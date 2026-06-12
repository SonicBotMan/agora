import { describe, expect, it, vi } from 'vitest';

vi.mock('./core/ipcUtils', () => ({
  resolveTaskWorkingDirectory: vi.fn(),
}));

vi.mock('./libs/endpoints', () => ({
  refreshEndpointsTestMode: vi.fn(),
}));

vi.mock('./libs/externalAgentConfigSync', () => ({
  applyExternalAgentConfigForEngine: vi.fn(),
  syncDeepSeekTuiGlobalConfigFromAgoraModel: vi.fn(),
  syncOpenCodeGlobalConfigFromAgoraModel: vi.fn(),
}));

vi.mock('./libs/openclawMemoryFile', () => ({
  addMemoryEntry: vi.fn(),
  deleteMemoryEntry: vi.fn(),
  ensureDefaultIdentity: vi.fn(),
  migrateSqliteToMemoryMd: vi.fn(),
  readBootstrapFile: vi.fn(),
  readMemoryEntries: vi.fn(),
  resolveMemoryFilePath: vi.fn(),
  searchMemoryEntries: vi.fn(),
  syncMemoryFileOnWorkspaceChange: vi.fn(),
  updateMemoryEntry: vi.fn(),
  writeBootstrapFile: vi.fn(),
}));

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
import { createMainIpcRuntimeSessionBuilderDeps } from './mainBootstrapIpcRuntimeSessionSupport';

describe('mainBootstrapIpcRuntimeSessionSupport', () => {
  it('maps runtime session dependencies and forwards session support helpers', () => {
    const fileActivityTracker = { id: 'file-activity' };
    const runtimeForwarder = {
      getFileActivityTracker: vi.fn().mockReturnValue(fileActivityTracker),
      getPermissionManager: vi.fn().mockReturnValue({ id: 'permission-manager' }),
      broadcastMessage: vi.fn(),
      broadcastError: vi.fn(),
    };
    const runtime = {
      getCoworkStore: vi.fn(),
      getCoworkEngineRouter: vi.fn(),
      getCoworkRuntimeForwarder: vi.fn().mockReturnValue(runtimeForwarder),
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
      applyExternalAgentConfigSourceForEngine: vi.fn(),
      resolveSessionRuntimeSnapshot: vi.fn(),
      prepareRuntimeSnapshotForTurn: vi.fn(),
      getHermesConfigSync: vi.fn(),
      getHermesEngineManager: vi.fn(),
      getOpenClawEngineManager: vi.fn(),
      syncOpenClawConfig: vi.fn(),
      bindExternalAgentCliInstallerForwarder: vi.fn(),
      bindHermesStatusForwarder: vi.fn(),
      bindOpenClawStatusForwarder: vi.fn(),
      getMergedExternalAgentEnvironmentSnapshot: vi.fn(),
      ensureHermesRunningForCowork: vi.fn(),
      ensureOpenClawRunningForCowork: vi.fn(),
      startHermesIMSessionSyncPolling: vi.fn(),
      syncHermesIMSessionsToCowork: vi.fn(),
      stopHermesIMSessionSyncPolling: vi.fn(),
      isFeishuEngineManagedByAgora: vi.fn(),
    };
    const sessionSupport = {
      getEngineNotReadyResponse: vi.fn(),
      mergeCoworkSystemPrompt: vi.fn(),
      importLocalAgentConfigToModelSettings: vi.fn(),
      isExternalAgentProviderAppType: vi.fn(),
    };

    const deps = createMainIpcRuntimeSessionBuilderDeps(
      { runtime } as never,
      sessionSupport,
    );

    expect(deps.getCoworkFileActivityTracker()).toBe(fileActivityTracker);
    expect(deps.getCoworkPermissionManager()).toEqual({ id: 'permission-manager' });
    expect(deps.getEngineNotReadyResponse).toBe(
      sessionSupport.getEngineNotReadyResponse,
    );
    expect(deps.getConversationIngestor).toBe(
      runtime.getConversationIngestor,
    );
    expect(deps.mergeCoworkSystemPrompt).toBe(
      sessionSupport.mergeCoworkSystemPrompt,
    );
    expect(deps.importLocalAgentConfigToModelSettings).toBe(
      sessionSupport.importLocalAgentConfigToModelSettings,
    );
    expect(deps.isExternalAgentProviderAppType).toBe(
      sessionSupport.isExternalAgentProviderAppType,
    );
    expect(deps.applyExternalAgentConfigForEngine).toBe(
      applyExternalAgentConfigForEngine,
    );
    expect(deps.resolveTaskWorkingDirectory).toBe(resolveTaskWorkingDirectory);
    expect(deps.syncOpenCodeGlobalConfigFromAgoraModel).toBe(
      syncOpenCodeGlobalConfigFromAgoraModel,
    );
    expect(deps.syncDeepSeekTuiGlobalConfigFromAgoraModel).toBe(
      syncDeepSeekTuiGlobalConfigFromAgoraModel,
    );
    expect(deps.resolveMemoryFilePath).toBe(resolveMemoryFilePath);
    expect(deps.readMemoryEntries).toBe(readMemoryEntries);
    expect(deps.searchMemoryEntries).toBe(searchMemoryEntries);
    expect(deps.addMemoryEntry).toBe(addMemoryEntry);
    expect(deps.updateMemoryEntry).toBe(updateMemoryEntry);
    expect(deps.deleteMemoryEntry).toBe(deleteMemoryEntry);
    expect(deps.migrateSqliteToMemoryMd).toBe(migrateSqliteToMemoryMd);
    expect(deps.syncMemoryFileOnWorkspaceChange).toBe(
      syncMemoryFileOnWorkspaceChange,
    );
    expect(deps.ensureDefaultIdentity).toBe(ensureDefaultIdentity);
    expect(deps.readBootstrapFile).toBe(readBootstrapFile);
    expect(deps.writeBootstrapFile).toBe(writeBootstrapFile);
    expect(deps.refreshEndpointsTestMode).toBe(refreshEndpointsTestMode);
  });
});
