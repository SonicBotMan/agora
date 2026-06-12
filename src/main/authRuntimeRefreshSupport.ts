import type {
  AuthTokens,
  RefreshedAuthTokens,
  SyncOpenClawConfigResult,
} from './authRuntimeBootstrapContract';
import {
  setAuthTokensGetter,
  setServerBaseUrlGetter,
} from './libs/claudeSettings';

const PROACTIVE_REFRESH_WINDOW_MS = 5 * 60 * 1000;

type AuthRefreshResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

export type AuthRefreshFetch = (
  url: string,
  init: {
    method: 'POST';
    headers: { 'Content-Type': string };
    body: string;
  },
) => Promise<AuthRefreshResponse>;

type AuthRefreshBody = {
  code: number;
  data?: { accessToken: string; refreshToken?: string };
};

interface RefreshAndPersistAuthTokenDeps {
  fetchAuthRefresh: AuthRefreshFetch;
  getServerApiBaseUrl: () => string;
  getAuthTokens: () => AuthTokens | null;
  saveAuthTokens: (accessToken: string, refreshToken: string) => void;
  successMessage: string;
  failureMessage: string;
  onRefreshSucceeded?: (accessToken: string) => void;
}

interface ManagedAuthTokenRefresherDeps {
  fetchAuthRefresh: AuthRefreshFetch;
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

interface AuthRuntimeGetterDeps {
  getAuthTokens: () => AuthTokens | null;
  refreshToken: (reason: string) => Promise<string | null>;
  getServerApiBaseUrl: () => string;
}

export async function fetchRefreshedAuthTokens(
  fetchAuthRefresh: AuthRefreshFetch,
  serverBaseUrl: string,
  refreshToken: string,
): Promise<RefreshedAuthTokens | null> {
  const response = await fetchAuthRefresh(`${serverBaseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as AuthRefreshBody;
  if (body.code !== 0 || !body.data?.accessToken) {
    return null;
  }

  return {
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken || refreshToken,
  };
}

export async function refreshAndPersistAuthToken(
  deps: RefreshAndPersistAuthTokenDeps,
): Promise<string | null> {
  try {
    const tokens = deps.getAuthTokens();
    if (!tokens?.refreshToken) {
      return null;
    }

    const refreshedTokens = await fetchRefreshedAuthTokens(
      deps.fetchAuthRefresh,
      deps.getServerApiBaseUrl(),
      tokens.refreshToken,
    );
    if (!refreshedTokens) {
      return null;
    }

    deps.saveAuthTokens(
      refreshedTokens.accessToken,
      refreshedTokens.refreshToken,
    );
    console.log(deps.successMessage);
    deps.onRefreshSucceeded?.(refreshedTokens.accessToken);
    return refreshedTokens.accessToken;
  } catch (error) {
    console.warn(deps.failureMessage, error);
    return null;
  }
}

export function createManagedAuthTokenRefresher(
  deps: ManagedAuthTokenRefresherDeps,
): (reason: string) => Promise<string | null> {
  return async (reason: string): Promise<string | null> => {
    const pendingRefresh = deps.getPendingTokenRefresh();
    if (pendingRefresh) {
      return pendingRefresh;
    }

    const refreshPromise = (async () => {
      try {
        return await refreshAndPersistAuthToken({
          fetchAuthRefresh: deps.fetchAuthRefresh,
          getServerApiBaseUrl: deps.getServerApiBaseUrl,
          getAuthTokens: deps.getAuthTokens,
          saveAuthTokens: deps.saveAuthTokens,
          successMessage: `[Auth] token refresh succeeded (reason: ${reason})`,
          failureMessage: `[Auth] token refresh failed (reason: ${reason}):`,
          onRefreshSucceeded: () => {
            deps.syncOpenClawConfig({
              reason: `token-refresh:${reason}`,
              restartGatewayIfRunning: false,
            }).catch((error) => {
              console.warn(
                '[Auth] post-refresh OpenClaw config sync failed:',
                error,
              );
            });
          },
        });
      } finally {
        deps.setPendingTokenRefresh(null);
      }
    })();

    deps.setPendingTokenRefresh(refreshPromise);
    return refreshPromise;
  };
}

export function installAuthRuntimeTokenGetters(
  deps: AuthRuntimeGetterDeps,
): void {
  setAuthTokensGetter(() => {
    const tokens = deps.getAuthTokens();
    if (!tokens) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(tokens.accessToken.split('.')[1], 'base64').toString(),
      ) as { exp?: number };
      const expiresAt = typeof payload.exp === 'number'
        ? payload.exp * 1000
        : 0;
      if (
        expiresAt !== 0
        && expiresAt - Date.now() < PROACTIVE_REFRESH_WINDOW_MS
      ) {
        void deps.refreshToken('proactive');
      }
    } catch {
      // Unable to parse JWT, return token as-is.
    }

    return tokens;
  });

  setServerBaseUrlGetter(() => deps.getServerApiBaseUrl());
}
