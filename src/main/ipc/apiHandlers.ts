/**
 * Agora — API/Copilot IPC Handlers
 *
 * CORS-bypass HTTP proxy (api:fetch/stream/cancel), GitHub Copilot OAuth
 * device-flow (github-copilot:*), and persisted API config (get/check/save).
 * Also owns the active stream-controller map (for cancel support).
 *
 * Extracted from main.ts lines 5651–5800 (github-copilot + config) and
 * lines 5995–6196 (api:fetch/stream/cancel + copilot retry).
 */

import { ipcMain, session, BrowserWindow, session as electronSession } from 'electron';

import {
  requestDeviceCode,
  pollForAccessToken,
  getCopilotToken,
  getGitHubUser,
  cancelPolling,
} from '../libs/githubCopilotAuth';
import {
  clearCopilotTokenState,
  refreshCopilotTokenNow,
  setCopilotTokenState,
} from '../libs/copilotTokenManager';
import { getCurrentApiConfig, resolveCurrentApiConfig } from '../libs/claudeSettings';
import { saveCoworkApiConfig } from '../libs/coworkConfigStore';
import { generateSessionTitle, probeCoworkModelReadiness } from '../libs/coworkUtil';
import { CoworkAgentEngine } from '../../shared/cowork/constants';

// In-memory controller map for active stream requests, keyed by requestId.
// Module-scope so it survives across handler invocations.
const activeStreamControllers = new Map<string, AbortController>();

const isCopilotUrl = (url: string): boolean => url.includes('githubcopilot.com');

const retryCopilotWithRefreshedToken = async (opts: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<{ headers: Record<string, string>; retried: boolean }> => {
  try {
    const state = await refreshCopilotTokenNow();
    const refreshedHeaders = { ...opts.headers, Authorization: `Bearer ${state.copilotToken}` };
    console.log('[CopilotRetry] token refreshed, retrying request');
    return { headers: refreshedHeaders, retried: true };
  } catch (err) {
    console.warn('[CopilotRetry] token refresh failed, not retrying:', err);
    return { headers: opts.headers, retried: false };
  }
};

export interface ApiDeps {
  getStore: () => {
    get: <T = unknown>(key: string) => T | undefined;
    set: <T = unknown>(key: string, value: T) => void;
    delete: (key: string) => void;
  };
  getCoworkStore: () => {
    listRecentCwds: (limit: number) => string[];
    getConfig: () => { agentEngine?: string };
  };
  getHermesConfigSync: () => {
    sync: (reason: string) => { success: boolean; changed?: boolean; error?: string };
  };
  getHermesEngineManager: () => {
    getStatus: () => { phase: string };
    restartGateway: () => Promise<{ phase: string; message?: string }>;
  };
}

export function registerApiHandlers(deps: ApiDeps): void {
  // ── GitHub Copilot device-flow auth ─────────────────────────────────

  ipcMain.handle('github-copilot:request-device-code', async () => {
    try {
      const result = await requestDeviceCode();
      return {
        userCode: result.user_code,
        verificationUri: result.verification_uri,
        deviceCode: result.device_code,
        interval: result.interval,
        expiresIn: result.expires_in,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to request device code');
    }
  });

  ipcMain.handle(
    'github-copilot:poll-for-token',
    async (
      _event,
      { deviceCode, interval, expiresIn }: { deviceCode: string; interval: number; expiresIn: number },
    ) => {
      try {
        const githubAccessToken = await pollForAccessToken(deviceCode, interval, expiresIn);
        const githubUser = await getGitHubUser(githubAccessToken);
        const { token: copilotToken, expiresAt, baseUrl } = await getCopilotToken(githubAccessToken);
        // Store the GitHub access token for later token refresh
        deps.getStore().set('github_copilot_github_token', githubAccessToken);
        // Register with the token manager for automatic refresh
        setCopilotTokenState({ copilotToken, baseUrl, expiresAt, githubToken: githubAccessToken });
        return { success: true, token: copilotToken, githubUser, baseUrl };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Authentication failed' };
      }
    },
  );

  ipcMain.handle('github-copilot:cancel-polling', async () => {
    cancelPolling();
  });

  ipcMain.handle('github-copilot:sign-out', async () => {
    deps.getStore().delete('github_copilot_github_token');
    clearCopilotTokenState();
  });

  ipcMain.handle('github-copilot:refresh-token', async () => {
    try {
      const state = await refreshCopilotTokenNow();
      return { success: true, token: state.copilotToken, baseUrl: state.baseUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' };
    }
  });

  // ── Session title generation + recent cwd listing ───────────────────

  ipcMain.handle('generate-session-title', async (_event, userInput: string | null) => {
    return generateSessionTitle(userInput);
  });

  ipcMain.handle('get-recent-cwds', async (_event, limit?: number) => {
    const boundedLimit = limit ? Math.min(Math.max(limit, 1), 20) : 8;
    return deps.getCoworkStore().listRecentCwds(boundedLimit);
  });

  // ── Persisted API config (Claude/OpenAI compatible) ─────────────────

  ipcMain.handle('get-api-config', async () => {
    return getCurrentApiConfig();
  });

  ipcMain.handle('check-api-config', async (_event, options?: { probeModel?: boolean }) => {
    const { config, error } = resolveCurrentApiConfig();
    if (config && options?.probeModel) {
      const probe = await probeCoworkModelReadiness();
      if (probe.ok === false) {
        return { hasConfig: false, config: null, error: probe.error };
      }
    }
    return { hasConfig: config !== null, config, error };
  });

  ipcMain.handle('save-api-config', async (_event, config: {
    apiKey: string;
    baseURL: string;
    model: string;
    apiType?: 'anthropic' | 'openai';
  }) => {
    try {
      saveCoworkApiConfig(config);
      if (deps.getCoworkStore().getConfig().agentEngine === CoworkAgentEngine.Hermes) {
        const syncResult = deps.getHermesConfigSync().sync('model-config-save');
        if (
          syncResult.success &&
          syncResult.changed &&
          deps.getHermesEngineManager().getStatus().phase === 'running'
        ) {
          void deps.getHermesEngineManager().restartGateway().catch((error) => {
            console.error('[Hermes] Failed to restart gateway after model config save:', error);
          });
        }
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save API config',
      };
    }
  });

  // ── CORS-bypass HTTP proxy ──────────────────────────────────────────

  ipcMain.handle('api:fetch', async (_event, options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }) => {
    const doFetch = async (headers: Record<string, string>) => {
      const response = await session.defaultSession.fetch(options.url, {
        method: options.method,
        headers,
        body: options.body,
      });

      const contentType = response.headers.get('content-type') || '';
      let data: string | object;

      if (contentType.includes('text/event-stream')) {
        data = await response.text();
      } else if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      };
    };

    try {
      let result = await doFetch(options.headers);

      // Auto-retry once for Copilot 401/403
      if (!result.ok && (result.status === 401 || result.status === 403) && isCopilotUrl(options.url)) {
        const { headers: refreshedHeaders, retried } = await retryCopilotWithRefreshedToken(options);
        if (retried) {
          result = await doFetch(refreshedHeaders);
        }
      }

      return result;
    } catch (error) {
      return {
        ok: false,
        status: 0,
        statusText: error instanceof Error ? error.message : 'Network error',
        headers: {},
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('api:stream', async (event, options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    requestId: string;
  }) => {
    const controller = new AbortController();
    activeStreamControllers.set(options.requestId, controller);

    try {
      let response = await electronSession.defaultSession.fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      if (!response.ok && (response.status === 401 || response.status === 403) && isCopilotUrl(options.url)) {
        const { headers: refreshedHeaders, retried } = await retryCopilotWithRefreshedToken(options);
        if (retried) {
          response = await electronSession.defaultSession.fetch(options.url, {
            method: options.method,
            headers: refreshedHeaders,
            body: options.body,
            signal: controller.signal,
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.text();
        activeStreamControllers.delete(options.requestId);
        return { ok: false, status: response.status, statusText: response.statusText, error: errorData };
      }

      if (!response.body) {
        activeStreamControllers.delete(options.requestId);
        return { ok: false, status: response.status, statusText: 'No response body' };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const readStream = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              event.sender.send(`api:stream:${options.requestId}:done`);
              break;
            }
            const chunk = decoder.decode(value);
            event.sender.send(`api:stream:${options.requestId}:data`, chunk);
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            event.sender.send(`api:stream:${options.requestId}:abort`);
          } else {
            event.sender.send(
              `api:stream:${options.requestId}:error`,
              error instanceof Error ? error.message : 'Stream error',
            );
          }
        } finally {
          activeStreamControllers.delete(options.requestId);
        }
      };

      // Async stream read; respond with success status immediately.
      readStream();

      return { ok: true, status: response.status, statusText: response.statusText };
    } catch (error) {
      activeStreamControllers.delete(options.requestId);
      return {
        ok: false,
        status: 0,
        statusText: error instanceof Error ? error.message : 'Network error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('api:stream:cancel', (_event, requestId: string) => {
    const controller = activeStreamControllers.get(requestId);
    if (controller) {
      controller.abort();
      activeStreamControllers.delete(requestId);
      return true;
    }
    return false;
  });
}
