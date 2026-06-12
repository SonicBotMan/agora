import type { BrowserWindow } from 'electron';

import type {
  FeishuEngineKeyType,
  FeishuRuntimeOwnershipType,
} from '../shared/im/constants';
import type {
  CronJobServiceLike,
  SyncOpenClawConfigResult,
} from './coworkEngineOpenClawConfigContract';
import type { CoworkStore } from './coworkStore';
import type { IMGatewayManager } from './im';
import type {
  CoworkAgentEngine,
  OpenClawRuntimeAdapter,
} from './libs/agentEngine';
import type { McpBridgeConfig, OpenClawConfigSync } from './libs/openclawConfigSync';
import type {
  OpenClawEngineManager,
  OpenClawEngineStatus,
} from './libs/openclawEngineManager';
import type { ensureDefaultIdentity } from './libs/openclawMemoryFile';
import type { OpenClawLocalFeishuDetection } from './libs/openclawSystemRuntime';
import type { SkillManager } from './skillManager';
import type { SqliteStore } from './sqliteStore';

export type { SyncOpenClawConfigResult } from './coworkEngineOpenClawConfigContract';

export interface OpenClawEngineSupportDeps {
  getWindows: () => BrowserWindow[];
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
  startMcpBridge: () => Promise<McpBridgeConfig | null>;
  getMcpBridgeConfig: () => McpBridgeConfig | null;
  ensureDefaultIdentity: typeof ensureDefaultIdentity;
}

export interface OpenClawEngineSupport {
  peekOpenClawEngineManager: () => OpenClawEngineManager | null;
  getOpenClawEngineManager: () => OpenClawEngineManager;
  getOpenClawConfigSync: () => OpenClawConfigSync;
  bindOpenClawStatusForwarder: () => void;
  bootstrapOpenClawEngine: (options?: {
    forceReinstall?: boolean;
    reason?: string;
  }) => Promise<OpenClawEngineStatus>;
  syncOpenClawConfig: (options?: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
  getPendingTokenRefresh: () => Promise<string | null> | null;
  setPendingTokenRefresh: (promise: Promise<string | null> | null) => void;
  ensureOpenClawRunningForCowork: () => Promise<OpenClawEngineStatus>;
  detectLocalOpenClawFeishu: () => OpenClawLocalFeishuDetection;
  hasLocalOpenClawFeishuConfigured: () => boolean;
}
