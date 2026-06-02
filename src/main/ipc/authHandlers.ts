/**
 * Agora — Auth IPC Handlers
 *
 * Extracted from main.ts lines ~2633–3146, ~6202–6246.
 * Handles authentication flows: login, token exchange/refresh, user/quota/profile queries,
 * logout, model fetching, and Qwen OAuth.
 */

import { ipcMain, net, shell } from 'electron';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface QuotaInfo {
  planName: string;
  subscriptionStatus: string;
  creditsLimit: number;
  creditsUsed: number;
  creditsRemaining: number;
}

// ---------------------------------------------------------------------------
// Dependencies injected by main.ts
// ---------------------------------------------------------------------------

export interface AuthDeps {
  /** Low-level kv store used to persist auth tokens and settings. */
  getStore: () => {
    get: <T = unknown>(key: string) => T | undefined;
    set: <T = unknown>(key: string, value: T) => void;
    delete: (key: string) => void;
  };

  /** Base URL for the Agora API server (e.g. https://api.agora.com). */
  getServerApiBaseUrl: () => string;

  /** Clear cached server-side model metadata (called after token expiry). */
  clearServerModelMetadata: () => void;

  /** Update the cached server model metadata from the response of auth:getModels. */
  updateServerModelMetadata: (
    data: Array<{
      modelId: string;
      modelName: string;
      provider: string;
      apiFormat: string;
      supportsImage?: boolean;
    }>,
  ) => void;

  /** Spin up (or reuse) a local HTTP server to receive the OAuth callback redirect. */
  ensureDesktopAuthCallbackUrl: () => Promise<string>;

  /** i18n translate function. */
  t: (key: string) => string;

  /** Get the buffered auth code received via deep link before renderer was ready. */
  getPendingAuthCode: () => string | null;

  /** Set (or clear) the buffered auth code. */
  setPendingAuthCode: (code: string | null) => void;

  /** Forward an auth code to the renderer process via the 'auth:callback' channel. */
  sendAuthCallback: (code: string) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers (moved into closure of registerAuthHandlers)
// ---------------------------------------------------------------------------

/**
 * Persist auth tokens into the kv store.
 */
function saveAuthTokens(
  getStore: AuthDeps['getStore'],
  accessToken: string,
  refreshToken: string,
): void {
  getStore().set('auth_tokens', { accessToken, refreshToken });
}

/**
 * Read persisted auth tokens from the kv store.
 */
function getAuthTokens(
  getStore: AuthDeps['getStore'],
): AuthTokens | null {
  return getStore().get<AuthTokens>('auth_tokens') || null;
}

/**
 * Remove persisted auth tokens from the kv store.
 */
function clearAuthTokens(getStore: AuthDeps['getStore']): void {
  getStore().delete('auth_tokens');
}

/**
 * Fetch with Bearer token, auto-refresh on 401 and retry once.
 */
async function fetchWithAuth(
  getStore: AuthDeps['getStore'],
  getServerApiBaseUrl: AuthDeps['getServerApiBaseUrl'],
  clearServerModelMetadata: AuthDeps['clearServerModelMetadata'],
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const tokens = getAuthTokens(getStore);
  if (!tokens) throw new Error('No auth tokens');

  const doFetch = (accessToken: string) =>
    net.fetch(url, {
      ...options,
      headers: {
        ...(options?.headers as Record<string, string>),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let resp = await doFetch(tokens.accessToken);

  if (resp.status === 401 && tokens.refreshToken) {
    const serverBaseUrl = getServerApiBaseUrl();
    const refreshResp = await net.fetch(`${serverBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (refreshResp.ok) {
      const refreshBody = (await refreshResp.json()) as {
        code: number;
        data: { accessToken: string; refreshToken?: string };
      };
      if (refreshBody.code === 0 && refreshBody.data) {
        saveAuthTokens(
          getStore,
          refreshBody.data.accessToken,
          refreshBody.data.refreshToken || tokens.refreshToken,
        );
        resp = await doFetch(refreshBody.data.accessToken);
      }
    } else {
      clearAuthTokens(getStore);
      clearServerModelMetadata();
    }
  }

  return resp;
}

/**
 * Normalize quota data from various server response formats into a unified shape.
 */
function normalizeQuota(
  raw: Record<string, unknown>,
  t: AuthDeps['t'],
): Record<string, unknown> | QuotaInfo {
  let creditsLimit = 0;
  let creditsUsed = 0;
  let planName = t('authPlanFree');
  let subscriptionStatus = 'free';

  if (typeof raw.freeCreditsTotal === 'number') {
    // Free user format from /api/user/quota
    creditsLimit = raw.freeCreditsTotal as number;
    creditsUsed = (raw.freeCreditsUsed as number) || 0;
    planName = (raw.planName as string) || t('authPlanFree');
    subscriptionStatus = (raw.subscriptionStatus as string) || 'free';
  } else if (typeof raw.monthlyCreditsLimit === 'number') {
    // Paid user format from /api/user/quota
    creditsLimit = raw.monthlyCreditsLimit as number;
    creditsUsed = (raw.monthlyCreditsUsed as number) || 0;
    planName = (raw.planName as string) || t('authPlanStandard');
    subscriptionStatus = (raw.subscriptionStatus as string) || 'active';
  } else if (typeof raw.dailyCreditsLimit === 'number') {
    // Legacy exchange format
    creditsLimit = raw.dailyCreditsLimit as number;
    creditsUsed = (raw.dailyCreditsUsed as number) || 0;
    planName = (raw.planName as string) || t('authPlanFree');
    subscriptionStatus = (raw.subscriptionStatus as string) || 'free';
  } else if (typeof raw.creditsLimit === 'number') {
    // Already normalized
    return raw;
  }

  return {
    planName,
    subscriptionStatus,
    creditsLimit,
    creditsUsed,
    creditsRemaining: Math.max(0, creditsLimit - creditsUsed),
  };
}

// ---------------------------------------------------------------------------
// Public registration function
// ---------------------------------------------------------------------------

export function registerAuthHandlers(deps: AuthDeps): void {
  const {
    getStore,
    getServerApiBaseUrl,
    clearServerModelMetadata: clearSrvMetadata,
    updateServerModelMetadata,
    ensureDesktopAuthCallbackUrl,
    t,
    getPendingAuthCode,
    setPendingAuthCode,
  } = deps;

  // ── Renderer-init: retrieve a buffered auth code on init ───────────────
  ipcMain.handle('auth:getPendingCallback', () => {
    const code = getPendingAuthCode();
    setPendingAuthCode(null);
    return code;
  });

  // ── Login ──────────────────────────────────────────────────────────────
  ipcMain.handle(
    'auth:login',
    async (
      _event,
      { loginUrl }: { loginUrl?: string } = {},
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const baseUrl = loginUrl || `${getServerApiBaseUrl()}/login`;
        const url = new URL(baseUrl);
        url.searchParams.set('source', 'electron');
        if (!loginUrl) {
          url.searchParams.set(
            'desktopCallback',
            await ensureDesktopAuthCallbackUrl(),
          );
        }
        await shell.openExternal(url.toString());
        return { success: true };
      } catch (error) {
        console.error('[Auth] login failed:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to open login',
        };
      }
    },
  );

  // ── Exchange auth code for tokens ─────────────────────────────────────
  ipcMain.handle(
    'auth:exchange',
    async (
      _event,
      { code }: { code: string },
    ): Promise<{
      success: boolean;
      error?: string;
      user?: Record<string, unknown>;
      quota?: Record<string, unknown> | QuotaInfo;
    }> => {
      try {
        const serverBaseUrl = getServerApiBaseUrl();
        const resp = await net.fetch(`${serverBaseUrl}/api/auth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authCode: code }),
        });
        if (!resp.ok) {
          return { success: false, error: `Exchange failed: ${resp.status}` };
        }
        const body = (await resp.json()) as {
          code: number;
          message?: string;
          data: {
            accessToken: string;
            refreshToken: string;
            user: Record<string, unknown>;
            quota: Record<string, unknown>;
          };
        };
        if (body.code !== 0 || !body.data) {
          return {
            success: false,
            error: body.message || 'Exchange failed',
          };
        }
        saveAuthTokens(getStore, body.data.accessToken, body.data.refreshToken);
        return {
          success: true,
          user: body.data.user,
          quota: normalizeQuota(body.data.quota, t),
        };
      } catch (error) {
        console.error('[Auth] exchange failed:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Exchange failed',
        };
      }
    },
  );

  // ── Get user profile + quota ──────────────────────────────────────────
  ipcMain.handle(
    'auth:getUser',
    async (): Promise<{
      success: boolean;
      user?: Record<string, unknown>;
      quota?: Record<string, unknown> | QuotaInfo | null;
    }> => {
      try {
        const tokens = getAuthTokens(getStore);
        if (!tokens) return { success: false };
        const serverBaseUrl = getServerApiBaseUrl();

        // Fetch user profile
        const profileResp = await fetchWithAuth(
          getStore,
          getServerApiBaseUrl,
          clearSrvMetadata,
          `${serverBaseUrl}/api/user/profile`,
        );
        if (!profileResp.ok) {
          if (profileResp.status === 401) {
            clearAuthTokens(getStore);
            clearSrvMetadata();
          }
          return { success: false };
        }
        const profileBody = (await profileResp.json()) as {
          code: number;
          data: Record<string, unknown>;
        };
        if (profileBody.code !== 0 || !profileBody.data) {
          return { success: false };
        }

        // Fetch quota separately
        const quotaResp = await fetchWithAuth(
          getStore,
          getServerApiBaseUrl,
          clearSrvMetadata,
          `${serverBaseUrl}/api/user/quota`,
        );
        let quota: Record<string, unknown> | QuotaInfo | null = null;
        if (quotaResp.ok) {
          const quotaBody = (await quotaResp.json()) as {
            code: number;
            data: Record<string, unknown>;
          };
          if (quotaBody.code === 0 && quotaBody.data) {
            quota = normalizeQuota(quotaBody.data, t);
          }
        }

        return { success: true, user: profileBody.data, quota };
      } catch {
        return { success: false };
      }
    },
  );

  // ── Get quota ─────────────────────────────────────────────────────────
  ipcMain.handle(
    'auth:getQuota',
    async (): Promise<{
      success: boolean;
      quota?: Record<string, unknown> | QuotaInfo;
    }> => {
      try {
        const tokens = getAuthTokens(getStore);
        if (!tokens) return { success: false };
        const serverBaseUrl = getServerApiBaseUrl();
        const resp = await fetchWithAuth(
          getStore,
          getServerApiBaseUrl,
          clearSrvMetadata,
          `${serverBaseUrl}/api/user/quota`,
        );
        if (!resp.ok) {
          if (resp.status === 401) {
            clearAuthTokens(getStore);
            clearSrvMetadata();
          }
          return { success: false };
        }
        const body = (await resp.json()) as {
          code: number;
          data: Record<string, unknown>;
        };
        if (body.code !== 0 || !body.data) return { success: false };
        return { success: true, quota: normalizeQuota(body.data, t) };
      } catch {
        return { success: false };
      }
    },
  );

  // ── Get profile summary ───────────────────────────────────────────────
  ipcMain.handle(
    'auth:getProfileSummary',
    async (): Promise<{
      success: boolean;
      data?: Record<string, unknown>;
    }> => {
      try {
        const tokens = getAuthTokens(getStore);
        if (!tokens) return { success: false };
        const serverBaseUrl = getServerApiBaseUrl();
        const resp = await fetchWithAuth(
          getStore,
          getServerApiBaseUrl,
          clearSrvMetadata,
          `${serverBaseUrl}/api/user/profile-summary`,
        );
        if (!resp.ok) {
          if (resp.status === 401) {
            clearAuthTokens(getStore);
            clearSrvMetadata();
          }
          return { success: false };
        }
        const body = (await resp.json()) as {
          code: number;
          data: Record<string, unknown>;
        };
        if (body.code !== 0 || !body.data) return { success: false };
        return { success: true, data: body.data };
      } catch {
        return { success: false };
      }
    },
  );

  // ── Logout ────────────────────────────────────────────────────────────
  ipcMain.handle(
    'auth:logout',
    async (): Promise<{ success: boolean }> => {
      try {
        const tokens = getAuthTokens(getStore);
        if (tokens) {
          const serverBaseUrl = getServerApiBaseUrl();
          await net
            .fetch(`${serverBaseUrl}/api/auth/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken: tokens.refreshToken }),
            })
            .catch(() => {
              /* best-effort */
            });
        }
        clearAuthTokens(getStore);
        clearSrvMetadata();
        return { success: true };
      } catch {
        clearAuthTokens(getStore);
        clearSrvMetadata();
        return { success: true };
      }
    },
  );

  // ── Refresh token ─────────────────────────────────────────────────────
  ipcMain.handle(
    'auth:refreshToken',
    async (): Promise<{
      success: boolean;
      accessToken?: string;
    }> => {
      try {
        const tokens = getAuthTokens(getStore);
        if (!tokens?.refreshToken) return { success: false };
        const serverBaseUrl = getServerApiBaseUrl();
        const resp = await net.fetch(`${serverBaseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!resp.ok) {
          clearAuthTokens(getStore);
          clearSrvMetadata();
          return { success: false };
        }
        const body = (await resp.json()) as {
          code: number;
          data: { accessToken: string; refreshToken?: string };
        };
        if (body.code !== 0 || !body.data) {
          clearAuthTokens(getStore);
          clearSrvMetadata();
          return { success: false };
        }
        saveAuthTokens(
          getStore,
          body.data.accessToken,
          body.data.refreshToken || tokens.refreshToken,
        );
        return { success: true, accessToken: body.data.accessToken };
      } catch {
        return { success: false };
      }
    },
  );

  // ── Get raw access token ──────────────────────────────────────────────
  ipcMain.handle('auth:getAccessToken', async (): Promise<string | null> => {
    const tokens = getAuthTokens(getStore);
    return tokens?.accessToken || null;
  });

  // ── Get available models ──────────────────────────────────────────────
  ipcMain.handle(
    'auth:getModels',
    async (): Promise<{
      success: boolean;
      models?: Array<{
        modelId: string;
        modelName: string;
        provider: string;
        apiFormat: string;
        supportsImage?: boolean;
      }>;
    }> => {
      try {
        const tokens = getAuthTokens(getStore);
        if (!tokens) {
          console.log('[Auth:getModels] No auth tokens available');
          return { success: false };
        }
        const serverBaseUrl = getServerApiBaseUrl();
        const url = `${serverBaseUrl}/api/models/available`;
        console.log('[Auth:getModels] Fetching:', url);
        const resp = await fetchWithAuth(
          getStore,
          getServerApiBaseUrl,
          clearSrvMetadata,
          url,
        );
        console.log('[Auth:getModels] Response status:', resp.status);
        if (!resp.ok) {
          console.log(
            '[Auth:getModels] Response not ok:',
            resp.status,
            resp.statusText,
          );
          return { success: false };
        }
        const data = (await resp.json()) as {
          code: number;
          data: Array<{
            modelId: string;
            modelName: string;
            provider: string;
            apiFormat: string;
            supportsImage?: boolean;
          }>;
        };
        console.log(
          '[Auth:getModels] Response data:',
          JSON.stringify(data).slice(0, 500),
        );
        if (data.code !== 0) return { success: false };
        // Cache server model metadata for use in OpenClaw config sync (supportsImage, etc.)
        updateServerModelMetadata(data.data);
        return { success: true, models: data.data };
      } catch (e) {
        console.error('[Auth:getModels] Error:', e);
        return { success: false };
      }
    },
  );

  // ── Qwen OAuth login ──────────────────────────────────────────────────
  ipcMain.handle('qwen:oauth:login', async (event) => {
    const { startQwenOAuth } = await import('../libs/qwenOAuth');

    const progressCallback = {
      update: (message: string) => {
        event.sender.send('qwen:oauth:progress', message);
      },
      stop: (message?: string) => {
        if (message) {
          event.sender.send('qwen:oauth:progress', message);
        }
      },
    };

    try {
      const oauthToken = await startQwenOAuth(progressCallback);
      return {
        success: true,
        data: oauthToken,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'OAuth login failed',
      };
    }
  });

  // ── Qwen OAuth refresh token ──────────────────────────────────────────
  ipcMain.handle('qwen:oauth:refresh', async (_event, refreshToken: string) => {
    const { refreshQwenOAuthToken } = await import('../libs/qwenOAuth');

    try {
      const oauthToken = await refreshQwenOAuthToken(refreshToken);
      return {
        success: true,
        data: oauthToken,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  });
}
