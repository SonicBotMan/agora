import type { BrowserWindow } from 'electron';

import type { CoworkAgentEngine } from '../shared/cowork/constants';
import type { SqliteStore } from './sqliteStore';

export type AppConfigSettings = {
  language?: string;
  theme?: 'light' | 'dark' | 'system';
  useSystemProxy?: boolean;
};

export type OpenClawEngineManagerLike = {
  getStatus: () => { phase?: string };
  restartGateway: () => Promise<unknown>;
};

export type OpenClawRuntimeAdapterLike = {
  onSystemResume: () => void;
};

export interface AppPostStartupLifecycleDeps {
  processArgs: string[];
  getStore: () => SqliteStore;
  getMainWindow: () => BrowserWindow | null;
  createWindow: () => void;
  setPendingAuthCode: (code: string) => void;
  getIMGatewayManager: () => { startAllEnabled: () => Promise<void> };
  resolveFeishuIMAgentEngine: () => CoworkAgentEngine;
  hermesEngineValue: CoworkAgentEngine;
  startHermesIMSessionSyncPolling: () => void;
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
  getOpenClawRuntimeAdapter: () => OpenClawRuntimeAdapterLike | null;
  setAutoLaunchEnabled: (enabled: boolean) => void;
  getUseSystemProxyFromConfig: (config?: { useSystemProxy?: boolean }) => boolean;
  applyProxyPreference: (enabled: boolean) => Promise<void>;
  getOpenClawEngineManager: () => OpenClawEngineManagerLike;
  updateTitleBarOverlay: () => void;
  setLanguage: (language: 'en' | 'zh') => void;
  updateTrayMenu: (getMainWindow: () => BrowserWindow | null) => void;
}
