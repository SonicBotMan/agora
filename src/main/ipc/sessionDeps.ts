import type { PermissionManager } from '../../core/PermissionManager';
import type { ConversationIngestor } from '../../features/knowledge-base';
import type { CoworkSessionRuntimeSnapshot } from '../../shared/cowork/runtimeSnapshot';
import type { CoworkMessage } from '../coworkStore';
import type { CoworkAgentEngine } from '../libs/agentEngine';

export interface SessionImageAttachment {
  name: string;
  mimeType: string;
  base64Data: string;
}

export interface SessionStartOptions {
  prompt: string;
  cwd?: string;
  systemPrompt?: string;
  title?: string;
  activeSkillIds?: string[];
  imageAttachments?: SessionImageAttachment[];
  agentId?: string;
  teamId?: string;
}

export interface SessionContinueOptions {
  sessionId: string;
  prompt: string;
  systemPrompt?: string;
  activeSkillIds?: string[];
  imageAttachments?: SessionImageAttachment[];
}

export interface SessionPinOptions {
  sessionId: string;
  pinned: boolean;
}

export interface SessionRenameOptions {
  sessionId: string;
  title: string;
}

export interface SessionDeps {
  // Store
  getCoworkStore: () => import('../coworkStore').CoworkStore;
  getCoworkEngineRouter: () => import('../libs/agentEngine').CoworkEngineRouter;
  getCoworkFileActivityTracker: () => import('../coworkFileActivityTracker').CoworkFileActivityTracker;
  getCoworkPermissionManager: () => PermissionManager;
  getRuntimeTelemetryStore: () => import('../runtimeTelemetryStore').RuntimeTelemetryStore;
  getIMGatewayManager: () => import('../im').IMGatewayManager;
  getExternalAgentCliInstaller: () => import('../libs/externalAgentCliInstaller').ExternalAgentCliInstaller;
  getExternalAgentProviderStore: () => import('../libs/externalAgentProviderStore').ExternalAgentProviderStore;
  getAgentTeamRunner: () => { run: (opts: { teamId: string; parentSessionId: string; prompt: string; runtimeSource: string }) => Promise<void> };
  getStore: () => import('../sqliteStore').SqliteStore;
  getSkillManager: () => import('../skillManager').SkillManager;
  getConversationIngestor: () => ConversationIngestor;

  // Agent engine helpers
  resolveCoworkAgentEngine: () => CoworkAgentEngine;
  resolveAgentRuntimeEngine: (agentId?: string | null) => CoworkAgentEngine;
  ensureCoworkEngineReady: (engine: CoworkAgentEngine) => Promise<{ success: boolean; engineStatus?: { message?: string }; error?: string }>;
  getEngineNotReadyResponse: (status: { message?: string }) => { success: boolean; [key: string]: unknown };
  mergeCoworkSystemPrompt: (engine: CoworkAgentEngine, systemPrompt?: string) => string | undefined;
  applyExternalAgentConfigSourceForEngine: (engine: CoworkAgentEngine) => void;
  applyExternalAgentConfigForEngine: (engine: CoworkAgentEngine, source: unknown) => void;
  resolveSessionRuntimeSnapshot: (engine: CoworkAgentEngine) => CoworkSessionRuntimeSnapshot;
  prepareRuntimeSnapshotForTurn: (snapshot?: CoworkSessionRuntimeSnapshot | null) => void;
  resolveTaskWorkingDirectory: (workspaceRoot: string) => string;

  // External agent config sync
  getHermesConfigSync: () => import('../libs/hermesConfigSync').HermesConfigSync;
  getHermesEngineManager: () => import('../libs/hermesEngineManager').HermesEngineManager;
  getOpenClawEngineManager: () => import('../libs/openclawEngineManager').OpenClawEngineManager;
  syncOpenClawConfig: (opts: { reason: string; restartGatewayIfRunning?: boolean }) => Promise<{ success: boolean; changed?: boolean; status?: { message?: string; phase?: string }; error?: string }>;
  syncOpenCodeGlobalConfigFromAgoraModel: () => void;
  syncDeepSeekTuiGlobalConfigFromAgoraModel: () => void;
  importLocalAgentConfigToModelSettings: (
    store: import('../sqliteStore').SqliteStore,
    appType: import('../libs/externalAgentProviderStore').ExternalAgentProviderAppType,
  ) => { success: boolean; imported: boolean; error?: string };
  isExternalAgentProviderAppType: (
    value: unknown,
  ) => value is import('../libs/externalAgentProviderStore').ExternalAgentProviderAppType;
  bindExternalAgentCliInstallerForwarder: () => void;
  bindHermesStatusForwarder: () => void;
  bindOpenClawStatusForwarder: () => void;
  getMergedExternalAgentEnvironmentSnapshot: () => Record<string, unknown>;

  // Memory file helpers (re-exported from lib)
  resolveMemoryFilePath: (workingDirectory: string) => string;
  readMemoryEntries: (filePath: string) => Array<{ id: string; text: string }>;
  searchMemoryEntries: (filePath: string, query: string) => Array<{ id: string; text: string }>;
  addMemoryEntry: (filePath: string, text: string) => { id: string; text: string };
  updateMemoryEntry: (filePath: string, id: string, text: string) => { id: string; text: string } | null;
  deleteMemoryEntry: (filePath: string, id: string) => boolean;
  migrateSqliteToMemoryMd: (filePath: string, opts: { isMigrationDone: () => boolean; markMigrationDone: () => void; getActiveMemoryTexts: () => string[] }) => void;
  syncMemoryFileOnWorkspaceChange: (oldDir: string | undefined, newDir: string) => { error?: string };
  ensureDefaultIdentity: (workingDirectory: string) => void;
  readBootstrapFile: (workingDirectory: string, filename: string) => string;
  writeBootstrapFile: (workingDirectory: string, filename: string, content: string) => void;

  // Broadcast helpers
  broadcastCoworkMessage: (sessionId: string, message: CoworkMessage) => void;
  broadcastCoworkError: (sessionId: string, error: string) => void;

  // Hermes IM session sync
  ensureHermesRunningForCowork: () => Promise<{ phase: string; message?: string }>;
  ensureOpenClawRunningForCowork: () => Promise<void>;
  startHermesIMSessionSyncPolling: () => void;
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
  stopHermesIMSessionSyncPolling: () => void;
  isFeishuEngineManagedByAgora: (key: string) => boolean;

  // Config normalization helpers
  refreshEndpointsTestMode: (store: import('../sqliteStore').SqliteStore) => void;
}
