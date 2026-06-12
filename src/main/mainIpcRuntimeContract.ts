import type { ResearchSession } from '../features/deep-research';
import type { FrontendStationRuntime } from '../features/frontend-station';
import type { TopicMonitor } from '../features/hot-topics';
import type {
  ConversationIngestor,
  HybridSearchEngine,
  KnowledgeStore,
} from '../features/knowledge-base';
import type {
  AgentsDeps,
  AllHandlerDeps,
  EngineDeps,
  ImDeps,
  SessionDeps,
} from './ipc';

export type MainIpcRuntimeHandlerDeps = Pick<
  AllHandlerDeps,
  | 'sessions'
  | 'im'
  | 'engines'
  | 'agents'
  | 'mcp'
  | 'api'
  | 'research'
  | 'knowledge'
  | 'hotTopics'
  | 'frontendStation'
>;

export interface MainIpcRuntimeSessionBuilderDeps {
  getCoworkStore: SessionDeps['getCoworkStore'];
  getCoworkEngineRouter: SessionDeps['getCoworkEngineRouter'];
  getCoworkFileActivityTracker: SessionDeps['getCoworkFileActivityTracker'];
  getCoworkPermissionManager: SessionDeps['getCoworkPermissionManager'];
  getRuntimeTelemetryStore: SessionDeps['getRuntimeTelemetryStore'];
  getIMGatewayManager: SessionDeps['getIMGatewayManager'];
  getExternalAgentCliInstaller: SessionDeps['getExternalAgentCliInstaller'];
  getExternalAgentProviderStore: SessionDeps['getExternalAgentProviderStore'];
  getAgentTeamRunner: SessionDeps['getAgentTeamRunner'];
  getStore: SessionDeps['getStore'];
  getSkillManager: SessionDeps['getSkillManager'];
  getConversationIngestor: () => ConversationIngestor;
  resolveCoworkAgentEngine: SessionDeps['resolveCoworkAgentEngine'];
  resolveAgentRuntimeEngine: SessionDeps['resolveAgentRuntimeEngine'];
  ensureCoworkEngineReady: SessionDeps['ensureCoworkEngineReady'];
  getEngineNotReadyResponse: SessionDeps['getEngineNotReadyResponse'];
  mergeCoworkSystemPrompt: SessionDeps['mergeCoworkSystemPrompt'];
  applyExternalAgentConfigSourceForEngine: SessionDeps['applyExternalAgentConfigSourceForEngine'];
  applyExternalAgentConfigForEngine: (
    engine: Parameters<SessionDeps['applyExternalAgentConfigForEngine']>[0],
    source: unknown,
  ) => void;
  resolveSessionRuntimeSnapshot: SessionDeps['resolveSessionRuntimeSnapshot'];
  prepareRuntimeSnapshotForTurn: SessionDeps['prepareRuntimeSnapshotForTurn'];
  resolveTaskWorkingDirectory: SessionDeps['resolveTaskWorkingDirectory'];
  getHermesConfigSync: SessionDeps['getHermesConfigSync'];
  getHermesEngineManager: SessionDeps['getHermesEngineManager'];
  getOpenClawEngineManager: SessionDeps['getOpenClawEngineManager'];
  syncOpenClawConfig: SessionDeps['syncOpenClawConfig'];
  syncOpenCodeGlobalConfigFromAgoraModel: SessionDeps['syncOpenCodeGlobalConfigFromAgoraModel'];
  syncDeepSeekTuiGlobalConfigFromAgoraModel: SessionDeps['syncDeepSeekTuiGlobalConfigFromAgoraModel'];
  importLocalAgentConfigToModelSettings: (
    store: ReturnType<SessionDeps['getStore']>,
    appType: unknown,
  ) => { success: boolean; imported?: boolean; error?: string };
  isExternalAgentProviderAppType: SessionDeps['isExternalAgentProviderAppType'];
  bindExternalAgentCliInstallerForwarder: SessionDeps['bindExternalAgentCliInstallerForwarder'];
  bindHermesStatusForwarder: SessionDeps['bindHermesStatusForwarder'];
  bindOpenClawStatusForwarder: SessionDeps['bindOpenClawStatusForwarder'];
  getMergedExternalAgentEnvironmentSnapshot: SessionDeps['getMergedExternalAgentEnvironmentSnapshot'];
  resolveMemoryFilePath: SessionDeps['resolveMemoryFilePath'];
  readMemoryEntries: SessionDeps['readMemoryEntries'];
  searchMemoryEntries: SessionDeps['searchMemoryEntries'];
  addMemoryEntry: SessionDeps['addMemoryEntry'];
  updateMemoryEntry: SessionDeps['updateMemoryEntry'];
  deleteMemoryEntry: SessionDeps['deleteMemoryEntry'];
  migrateSqliteToMemoryMd: SessionDeps['migrateSqliteToMemoryMd'];
  syncMemoryFileOnWorkspaceChange: SessionDeps['syncMemoryFileOnWorkspaceChange'];
  ensureDefaultIdentity: SessionDeps['ensureDefaultIdentity'];
  readBootstrapFile: SessionDeps['readBootstrapFile'];
  writeBootstrapFile: SessionDeps['writeBootstrapFile'];
  broadcastCoworkMessage: SessionDeps['broadcastCoworkMessage'];
  broadcastCoworkError: SessionDeps['broadcastCoworkError'];
  ensureHermesRunningForCowork: SessionDeps['ensureHermesRunningForCowork'];
  ensureOpenClawRunningForCowork: () => Promise<unknown>;
  startHermesIMSessionSyncPolling: SessionDeps['startHermesIMSessionSyncPolling'];
  syncHermesIMSessionsToCowork: SessionDeps['syncHermesIMSessionsToCowork'];
  stopHermesIMSessionSyncPolling: SessionDeps['stopHermesIMSessionSyncPolling'];
  isFeishuEngineManagedByAgora: (key: unknown) => boolean;
  refreshEndpointsTestMode: SessionDeps['refreshEndpointsTestMode'];
}

export interface MainIpcRuntimeImBuilderDeps {
  getStore: SessionDeps['getStore'];
  getCoworkStore: SessionDeps['getCoworkStore'];
  getIMGatewayManager: SessionDeps['getIMGatewayManager'];
  getOpenClawEngineManager: SessionDeps['getOpenClawEngineManager'];
  getHermesEngineManager: SessionDeps['getHermesEngineManager'];
  getOpenClawConfigSync: ImDeps['getOpenClawConfigSync'];
  getHermesConfigSync: SessionDeps['getHermesConfigSync'];
  openClawRuntimeAdapter: ImDeps['openClawRuntimeAdapter'];
  syncOpenClawConfig: SessionDeps['syncOpenClawConfig'];
  resolveFeishuIMAgentEngine: ImDeps['resolveFeishuIMAgentEngine'];
  isFeishuEngineManagedByAgora: (key: unknown) => boolean;
  normalizeFeishuEngineKey: (value: unknown) => unknown;
  getFeishuRuntimeOwnership: (key: unknown) => unknown;
  getFeishuRuntimeOwnershipStatus: (key: unknown, ownership: unknown) => unknown;
  transferFeishuToLocalRuntime: (
    engineKey: unknown,
    instances: unknown,
    engineManagers: unknown,
  ) => Promise<unknown>;
  transferFeishuToAgoraRuntime: (engineKey: unknown) => Promise<unknown>;
  detectLocalOpenClawFeishu: () => unknown;
  importOpenClawLocalFeishuConfig: () => unknown;
  listPairingRequests: (platform: string, stateDir: string) => unknown;
  readAllowFromStore: (platform: string, stateDir: string) => unknown;
  approvePairingCode: (platform: string, code: string, stateDir: string) => unknown;
  rejectPairingRequest: (platform: string, code: string, stateDir: string) => unknown;
  startHermesIMSessionSyncPolling: SessionDeps['startHermesIMSessionSyncPolling'];
  syncHermesIMSessionsToCowork: SessionDeps['syncHermesIMSessionsToCowork'];
}

export interface MainIpcRuntimeServiceBuilderDeps {
  getCoworkStore: SessionDeps['getCoworkStore'];
  getExternalAgentCliInstaller: SessionDeps['getExternalAgentCliInstaller'];
  bindExternalAgentCliInstallerForwarder: SessionDeps['bindExternalAgentCliInstallerForwarder'];
  getOpenClawEngineManager: SessionDeps['getOpenClawEngineManager'];
  getHermesEngineManager: SessionDeps['getHermesEngineManager'];
  getHermesConfigSync: SessionDeps['getHermesConfigSync'];
  bootstrapHermesEngine: EngineDeps['bootstrapHermesEngine'];
  getAgentManager: AgentsDeps['getAgentManager'];
  syncOpenClawConfig: SessionDeps['syncOpenClawConfig'];
  getIMGatewayManager: SessionDeps['getIMGatewayManager'];
  getMcpStore: AllHandlerDeps['mcp']['getMcpStore'];
  refreshMcpBridge: AllHandlerDeps['mcp']['refreshMcpBridge'];
  getServerApiBaseUrl: AllHandlerDeps['mcp']['getServerApiBaseUrl'];
  getStore: SessionDeps['getStore'];
  getKnowledgeStore: () => KnowledgeStore;
  getKnowledgeSearchEngine: () => HybridSearchEngine;
  getResearchSession: () => ResearchSession;
  getTopicMonitor: () => TopicMonitor;
  getFrontendStationRuntime: () => FrontendStationRuntime;
}

export type MainIpcRuntimeBuilderDeps =
  & MainIpcRuntimeSessionBuilderDeps
  & MainIpcRuntimeImBuilderDeps
  & MainIpcRuntimeServiceBuilderDeps;
