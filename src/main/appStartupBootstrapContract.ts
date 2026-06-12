import type { BrowserWindow } from 'electron';

import type { CoworkAgentEngine } from '../shared/cowork/constants';
import type { IMStore } from './im/imStore';
import type { SqliteStore } from './sqliteStore';

type AppConfigSettings = {
  useSystemProxy?: boolean;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type SyncOpenClawConfigResult = {
  success: boolean;
  changed?: boolean;
  error?: string;
};

type IMGatewayManagerLike = {
  startAllEnabled: () => Promise<void>;
  getIMStore: () => IMStore;
};

type McpStoreLike = {
  listServers: () => { id: string; name: string }[];
  updateServer: (
    id: string,
    input: {
      name: string;
      description?: string;
      transportType: 'stdio' | 'sse' | 'http';
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    },
  ) => void;
  createServer: (input: {
    name: string;
    description?: string;
    transportType: 'stdio' | 'sse' | 'http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  }) => void;
  deleteServer: (id: string) => void;
};

type OpenClawRuntimeAdapterLike = {
  onSystemResume: () => void;
};

type OpenClawEngineManagerLike = {
  getStatus: () => { phase?: string };
  restartGateway: () => Promise<unknown>;
};

export interface AppStartupBootstrapDeps {
  app: {
    whenReady: () => Promise<void>;
  };
  isDev: boolean;
  initStore: () => Promise<SqliteStore>;
  setStore: (store: SqliteStore) => void;
  getStore: () => SqliteStore;
  getCoworkStore: () => {
    resetRunningSessions: () => number;
    setConfig: (config: { executionMode?: 'local' }) => void;
    getConfig: () => { workingDirectory: string };
  };
  getRuntimeTelemetryStore: () => {
    resetRunningCalls: () => number;
  };
  getServerApiBaseUrl: () => string;
  getAuthTokens: () => AuthTokens | null;
  saveAuthTokens: (accessToken: string, refreshToken: string) => void;
  getPendingTokenRefresh: () => Promise<string | null> | null;
  setPendingTokenRefresh: (promise: Promise<string | null> | null) => void;
  syncOpenClawConfig: (opts: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
  getIMGatewayManager: () => IMGatewayManagerLike;
  getMcpStore: () => McpStoreLike;
  bindCoworkRuntimeForwarder: () => void;
  bindOpenClawStatusForwarder: () => void;
  getHermesConfigSync: () => {
    sync: (reason: string) => { success: boolean; error?: string };
  };
  resolveCoworkAgentEngine: () => CoworkAgentEngine;
  ensureOpenClawRunningForCowork: () => Promise<unknown>;
  getCronJobService: () => {
    startPolling: () => void;
  };
  getSkillManager: () => {
    onSkillsChanged: (handler: () => void) => void;
    syncBundledSkillsToUserData: () => void;
    recoverInterruptedUpgrades: () => void;
    startWatching: () => void;
  };
  getUseSystemProxyFromConfig: (
    config?: AppConfigSettings,
  ) => boolean;
  applyProxyPreference: (enabled: boolean) => Promise<void>;
  processArgs: string[];
  getMainWindow: () => BrowserWindow | null;
  createWindow: () => void;
  setPendingAuthCode: (code: string | null) => void;
  resolveFeishuIMAgentEngine: () => CoworkAgentEngine;
  hermesEngineValue: CoworkAgentEngine;
  startHermesIMSessionSyncPolling: () => void;
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
  getOpenClawRuntimeAdapter: () => OpenClawRuntimeAdapterLike | null;
  setAutoLaunchEnabled: (enabled: boolean) => void;
  getOpenClawEngineManager: () => OpenClawEngineManagerLike;
  updateTitleBarOverlay: () => void;
  setLanguage: (language: 'en' | 'zh') => void;
  updateTrayMenu: (getMainWindow: () => BrowserWindow | null) => void;
}
