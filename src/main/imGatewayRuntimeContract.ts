import type { BrowserWindow } from 'electron';

import type { ScheduledTask, ScheduledTaskInput } from '../scheduled-task/types';
import { CoworkAgentEngine as CoworkAgentEngineValue } from '../shared/cowork/constants';
import type {
  FeishuEngineKeyType,
  FeishuManagementModeType,
  FeishuRuntimeOwnershipType,
} from '../shared/im/constants';
import type { CoworkStore } from './coworkStore';
import type {
  IMGatewayManager,
  IMGatewayManagerOptions,
} from './im';
import type {
  CoworkAgentEngine as AgentEngineType,
  OpenClawRuntimeAdapter,
} from './libs/agentEngine';
import type { CoworkRuntime } from './libs/agentEngine/types';
import type { HermesEngineStatus } from './libs/hermesEngineManager';
import type { OpenClawEngineStatus } from './libs/openclawEngineManager';
import type { OpenClawLocalFeishuDetection } from './libs/openclawSystemRuntime';
import type { SkillManager } from './skillManager';
import type { SqliteStore } from './sqliteStore';

export type CronJobServiceLike = {
  addJob: (input: ScheduledTaskInput) => Promise<ScheduledTask>;
};

export type FeishuRuntimeOwnershipStatusResolver = (
  engineKey: FeishuEngineKeyType,
  ownership: FeishuRuntimeOwnershipType,
) => ReturnType<
  NonNullable<IMGatewayManagerOptions['getFeishuRuntimeOwnershipStatus']>
>;

export type FeishuIMAgentEngine =
  | typeof CoworkAgentEngineValue.OpenClaw
  | typeof CoworkAgentEngineValue.Hermes
  | typeof CoworkAgentEngineValue.ClaudeCode
  | typeof CoworkAgentEngineValue.Codex;

export interface IMGatewayFeishuSupportDeps {
  getIMGatewayManager: () => IMGatewayManager;
  resolveCoworkAgentEngine: () => AgentEngineType;
  ensureOpenClawRunningForCowork: () => Promise<OpenClawEngineStatus>;
  ensureHermesRunningForCowork: () => Promise<HermesEngineStatus>;
}

export interface IMGatewayFeishuSupport {
  resolveFeishuIMAgentEngine: () => FeishuIMAgentEngine | null;
  resolveFeishuEngineKey: () => FeishuEngineKeyType;
  normalizeFeishuEngineKey: (value: unknown) => FeishuEngineKeyType;
  getFeishuManagementMode: () => FeishuManagementModeType;
  getFeishuRuntimeOwnership: (
    engineKey: FeishuEngineKeyType,
  ) => FeishuRuntimeOwnershipType;
  isFeishuEngineManagedByAgora: (
    engineKey: FeishuEngineKeyType,
  ) => boolean;
  ensureCoworkReady: () => Promise<void>;
}

export interface IMGatewayScheduledTaskDeps {
  getCronJobService: () => CronJobServiceLike;
}

export type AgentTeamRunnerLike = {
  run: (opts: {
    teamId: string;
    parentSessionId: string;
    prompt: string;
    runtimeSource: string;
  }) => Promise<void>;
};

export interface IMGatewayRuntimeDeps {
  getWindows: () => BrowserWindow[];
  getStore: () => SqliteStore;
  getCoworkStore: () => CoworkStore;
  getCoworkEngineRouter: () => CoworkRuntime;
  getSkillManager: () => SkillManager;
  getAgentTeamRunner: () => AgentTeamRunnerLike;
  getCronJobService: () => CronJobServiceLike;
  resolveCoworkAgentEngine: () => AgentEngineType;
  ensureOpenClawRunningForCowork: () => Promise<OpenClawEngineStatus>;
  ensureHermesRunningForCowork: () => Promise<HermesEngineStatus>;
  getFeishuRuntimeOwnershipStatus: FeishuRuntimeOwnershipStatusResolver;
  detectLocalOpenClawFeishu: () => OpenClawLocalFeishuDetection;
  hasLocalOpenClawFeishuConfigured: () => boolean;
  syncOpenClawConfig: (options: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<unknown>;
  getHermesConfigSync: () => {
    sync: (
      reason: string,
    ) => { success: boolean; error?: string };
  };
  peekOpenClawRuntimeAdapter: () => OpenClawRuntimeAdapter | null;
  startHermesIMSessionSyncPolling: () => void;
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
}

export interface IMGatewayRuntime {
  peekIMGatewayManager: () => IMGatewayManager | null;
  getIMGatewayManager: () => IMGatewayManager;
  resolveFeishuIMAgentEngine: () => FeishuIMAgentEngine | null;
  normalizeFeishuEngineKey: (value: unknown) => FeishuEngineKeyType;
  getFeishuManagementMode: () => FeishuManagementModeType;
  getFeishuRuntimeOwnership: (
    engineKey: FeishuEngineKeyType,
  ) => FeishuRuntimeOwnershipType;
  isFeishuEngineManagedByAgora: (
    engineKey: FeishuEngineKeyType,
  ) => boolean;
}
