import type { BrowserWindow } from 'electron';

import { ResearchSession } from '../features/deep-research';
import { FrontendStationRuntime } from '../features/frontend-station';
import { type TopicActionIMGateway,TopicMonitor } from '../features/hot-topics';
import {
  ConversationIngestor,
  EmbeddingEngine,
  HybridSearchEngine,
  KnowledgeStore,
  ResearchIngestor,
} from '../features/knowledge-base';
import { type SyncOpenClawConfigResult } from './coworkEngineRuntime';
import { KnowledgeStoreSqliteAdapter } from './knowledgeStoreSqliteAdapter';
import { DeepSeekTuiRuntimeManager } from './libs/deepSeekTuiRuntimeManager';
import { ExternalAgentCliInstaller } from './libs/externalAgentCliInstaller';
import { getExternalAgentEnvironmentSnapshot } from './libs/externalAgentEnvironment';
import {
  createMcpBridgeRuntime,
  type McpBridgeRuntime,
} from './mcpBridgeRuntime';
import { SkillManager } from './skillManager';
import { SqliteStore } from './sqliteStore';

export interface MainRuntimeRegistryServiceSupportDeps {
  getStore: () => SqliteStore;
  getWindows: () => BrowserWindow[];
  getIMGatewayManager?: () => TopicActionIMGateway | null;
  syncOpenClawConfig: (options: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
}

export interface MainRuntimeRegistryServiceSupport {
  getMcpBridgeRuntime: () => McpBridgeRuntime;
  getExternalAgentCliInstaller: () => ExternalAgentCliInstaller;
  getDeepSeekTuiRuntimeManager: () => DeepSeekTuiRuntimeManager;
  getMergedExternalAgentEnvironmentSnapshot: () => Record<string, unknown>;
  getSkillManager: () => SkillManager;
  getKnowledgeStore: () => KnowledgeStore;
  getKnowledgeSearchEngine: () => HybridSearchEngine;
  getConversationIngestor: () => ConversationIngestor;
  getResearchSession: () => ResearchSession;
  getTopicMonitor: () => TopicMonitor;
  getFrontendStationRuntime: () => FrontendStationRuntime;
  peekSkillManager: () => SkillManager | null;
}

export function createMainRuntimeRegistryServiceSupport(
  deps: MainRuntimeRegistryServiceSupportDeps,
): MainRuntimeRegistryServiceSupport {
  let externalAgentCliInstaller: ExternalAgentCliInstaller | null = null;
  let deepSeekTuiRuntimeManager: DeepSeekTuiRuntimeManager | null = null;
  let skillManager: SkillManager | null = null;
  let mcpBridgeRuntime: McpBridgeRuntime | null = null;
  let knowledgeStore: KnowledgeStore | null = null;
  let knowledgeStoreAdapter: KnowledgeStoreSqliteAdapter | null = null;
  let knowledgeEmbeddingEngine: EmbeddingEngine | null = null;
  let knowledgeSearchEngine: HybridSearchEngine | null = null;
  let conversationIngestor: ConversationIngestor | null = null;
  let researchSession: ResearchSession | null = null;
  let topicMonitor: TopicMonitor | null = null;
  let frontendStationRuntime: FrontendStationRuntime | null = null;

  const getMcpBridgeRuntime = (): McpBridgeRuntime => {
    if (!mcpBridgeRuntime) {
      mcpBridgeRuntime = createMcpBridgeRuntime({
        getStore: deps.getStore,
        getWindows: deps.getWindows,
        syncOpenClawConfig: (options) => deps.syncOpenClawConfig(options),
      });
    }
    return mcpBridgeRuntime;
  };

  const getExternalAgentCliInstaller = (): ExternalAgentCliInstaller => {
    if (!externalAgentCliInstaller) {
      externalAgentCliInstaller = new ExternalAgentCliInstaller();
    }
    return externalAgentCliInstaller;
  };

  const getDeepSeekTuiRuntimeManager = (): DeepSeekTuiRuntimeManager => {
    if (!deepSeekTuiRuntimeManager) {
      deepSeekTuiRuntimeManager = new DeepSeekTuiRuntimeManager();
    }
    return deepSeekTuiRuntimeManager;
  };

  const getMergedExternalAgentEnvironmentSnapshot = (): Record<
    string,
    unknown
  > => ({
    ...getExternalAgentEnvironmentSnapshot(),
  });

  const getSkillManager = () => {
    if (!skillManager) {
      skillManager = new SkillManager(deps.getStore);
    }
    return skillManager;
  };

  const getKnowledgeStoreAdapter = () => {
    if (!knowledgeStoreAdapter) {
      knowledgeStoreAdapter = new KnowledgeStoreSqliteAdapter(
        deps.getStore().getDatabase(),
      );
    }
    return knowledgeStoreAdapter;
  };

  const getKnowledgeStore = () => {
    if (!knowledgeStore) {
      const adapter = getKnowledgeStoreAdapter();
      knowledgeStore = new KnowledgeStore({
        adapter,
        initialDocuments: adapter.listDocuments(),
      });
    }
    return knowledgeStore;
  };

  const getKnowledgeEmbeddingEngine = () => {
    if (!knowledgeEmbeddingEngine) {
      knowledgeEmbeddingEngine = new EmbeddingEngine();
    }
    return knowledgeEmbeddingEngine;
  };

  const getKnowledgeSearchEngine = () => {
    if (!knowledgeSearchEngine) {
      knowledgeSearchEngine = new HybridSearchEngine(
        getKnowledgeStore(),
        getKnowledgeEmbeddingEngine(),
      );
    }
    return knowledgeSearchEngine;
  };

  const getConversationIngestor = () => {
    if (!conversationIngestor) {
      conversationIngestor = new ConversationIngestor({
        knowledgeStore: getKnowledgeStore(),
        embeddingEngine: getKnowledgeEmbeddingEngine(),
      });
    }
    return conversationIngestor;
  };

  const getResearchSession = () => {
    if (!researchSession) {
      researchSession = new ResearchSession({
        getIMGatewayManager: deps.getIMGatewayManager,
        researchIngestor: new ResearchIngestor({
          knowledgeStore: getKnowledgeStore(),
          embeddingEngine: getKnowledgeEmbeddingEngine(),
        }),
      });
    }
    return researchSession;
  };

  const getTopicMonitor = () => {
    if (!topicMonitor) {
      topicMonitor = new TopicMonitor({
        getIMGatewayManager: deps.getIMGatewayManager,
        researchSession: getResearchSession(),
        knowledgeStore: getKnowledgeStore(),
        embeddingEngine: getKnowledgeEmbeddingEngine(),
      });
    }
    return topicMonitor;
  };

  const getFrontendStationRuntime = () => {
    if (!frontendStationRuntime) {
      frontendStationRuntime = new FrontendStationRuntime();
    }
    return frontendStationRuntime;
  };

  const peekSkillManager = () => skillManager ?? null;

  return {
    getMcpBridgeRuntime,
    getExternalAgentCliInstaller,
    getDeepSeekTuiRuntimeManager,
    getMergedExternalAgentEnvironmentSnapshot,
    getSkillManager,
    getKnowledgeStore,
    getKnowledgeSearchEngine,
    getConversationIngestor,
    getResearchSession,
    getTopicMonitor,
    getFrontendStationRuntime,
    peekSkillManager,
  };
}
