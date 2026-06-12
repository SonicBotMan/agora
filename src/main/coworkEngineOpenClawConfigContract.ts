import type {
  FeishuEngineKeyType,
  FeishuRuntimeOwnershipType,
} from '../shared/im/constants';
import type { CoworkStore } from './coworkStore';
import type { IMGatewayManager } from './im';
import type {
  CoworkAgentEngine,
  OpenClawRuntimeAdapter,
} from './libs/agentEngine';
import type {
  McpBridgeConfig,
  OpenClawConfigSync,
} from './libs/openclawConfigSync';
import type {
  OpenClawEngineManager,
  OpenClawEngineStatus,
} from './libs/openclawEngineManager';
import type { OpenClawLocalFeishuDetection } from './libs/openclawSystemRuntime';
import type { SkillManager } from './skillManager';
import type { SqliteStore } from './sqliteStore';

export type SyncOpenClawConfigResult = {
  success: boolean;
  changed: boolean;
  status?: OpenClawEngineStatus;
  error?: string;
};

export type CronJobServiceLike = {
  getJobNameSync: (jobId: string) => string;
  hasRunningJobs: () => boolean;
};

export interface OpenClawConfigSupportDeps {
  getStore: () => SqliteStore;
  getCoworkStore: () => CoworkStore;
  getSkillManager: () => SkillManager;
  getIMGatewayManager: () => IMGatewayManager;
  getFeishuRuntimeOwnership: (
    engineKey: FeishuEngineKeyType,
  ) => FeishuRuntimeOwnershipType;
  resolveFeishuIMAgentEngine: () => CoworkAgentEngine;
  getOpenClawRuntimeAdapter: () => OpenClawRuntimeAdapter | null;
  getCronJobService: () => CronJobServiceLike;
  getMcpBridgeConfig: () => McpBridgeConfig | null;
  getOpenClawEngineManager: () => OpenClawEngineManager;
}

export interface OpenClawConfigSupport {
  getOpenClawConfigSync: () => OpenClawConfigSync;
  syncOpenClawConfig: (options?: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
  detectLocalOpenClawFeishu: () => OpenClawLocalFeishuDetection;
  hasLocalOpenClawFeishuConfigured: () => boolean;
}
