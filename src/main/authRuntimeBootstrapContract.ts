import type { SqliteStore } from './sqliteStore';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshedAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type SyncOpenClawConfigResult = {
  success: boolean;
  changed?: boolean;
  status?: unknown;
  error?: string;
};

export interface AuthRuntimeBootstrapDeps {
  getStore: () => SqliteStore;
  getServerApiBaseUrl: () => string;
  getAuthTokens: () => AuthTokens | null;
  saveAuthTokens: (accessToken: string, refreshToken: string) => void;
  getPendingTokenRefresh: () => Promise<string | null> | null;
  setPendingTokenRefresh: (promise: Promise<string | null> | null) => void;
  syncOpenClawConfig: (opts: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<SyncOpenClawConfigResult>;
}
