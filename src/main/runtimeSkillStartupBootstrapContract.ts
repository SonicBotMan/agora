import type { CoworkAgentEngine } from '../shared/cowork/constants';
import type { SqliteStore } from './sqliteStore';

export type RuntimeSkillAppConfig = {
  useSystemProxy?: boolean;
};

export type SyncOpenClawConfigResult = {
  success: boolean;
  changed?: boolean;
  error?: string;
};

export type SkillManagerLike = {
  onSkillsChanged: (handler: () => void) => void;
  syncBundledSkillsToUserData: () => void;
  recoverInterruptedUpgrades: () => void;
  startWatching: () => void;
};

export type SkillServiceManagerLike = {
  startAll: () => Promise<void>;
};

export interface RuntimeSkillStartupBootstrapDeps {
  store: SqliteStore;
  bindCoworkRuntimeForwarder: () => void;
  bindOpenClawStatusForwarder: () => void;
  syncOpenClawConfig: (opts: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
  getHermesConfigSync: () => {
    sync: (reason: string) => { success: boolean; error?: string };
  };
  resolveCoworkAgentEngine: () => CoworkAgentEngine;
  ensureOpenClawRunningForCowork: () => Promise<void>;
  getCronJobService: () => {
    startPolling: () => void;
  };
  getSkillManager: () => SkillManagerLike;
  getUseSystemProxyFromConfig: (
    config?: { useSystemProxy?: boolean },
  ) => boolean;
  applyProxyPreference: (enabled: boolean) => Promise<void>;
}
