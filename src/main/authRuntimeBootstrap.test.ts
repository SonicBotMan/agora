import { beforeEach, describe, expect, it, vi } from 'vitest';

const authRuntimeBootstrapTestState = vi.hoisted(() => {
  const fetch = vi.fn();
  const initializeCopilotRuntime = vi.fn();
  const registerAuthProxyTokenRefreshers = vi.fn();
  const refreshOnce = vi.fn().mockResolvedValue('next-access');
  const createManagedAuthTokenRefresher = vi.fn(() => refreshOnce);
  const installAuthRuntimeTokenGetters = vi.fn();
  const refreshAndPersistAuthToken = vi.fn().mockResolvedValue('refreshed');
  const startOpenClawTokenProxy = vi.fn().mockResolvedValue(undefined);
  const getCopilotToken = vi.fn().mockResolvedValue('copilot-token');
  const refreshCopilotTokenNow = vi.fn().mockResolvedValue('copilot-refresh');

  return {
    fetch,
    initializeCopilotRuntime,
    registerAuthProxyTokenRefreshers,
    refreshOnce,
    createManagedAuthTokenRefresher,
    installAuthRuntimeTokenGetters,
    refreshAndPersistAuthToken,
    startOpenClawTokenProxy,
    getCopilotToken,
    refreshCopilotTokenNow,
  };
});

vi.mock('electron', () => ({
  net: {
    fetch: authRuntimeBootstrapTestState.fetch,
  },
}));

vi.mock('./authRuntimeCopilotSupport', () => ({
  initializeCopilotRuntime:
    authRuntimeBootstrapTestState.initializeCopilotRuntime,
  registerAuthProxyTokenRefreshers:
    authRuntimeBootstrapTestState.registerAuthProxyTokenRefreshers,
}));

vi.mock('./authRuntimeRefreshSupport', () => ({
  createManagedAuthTokenRefresher:
    authRuntimeBootstrapTestState.createManagedAuthTokenRefresher,
  installAuthRuntimeTokenGetters:
    authRuntimeBootstrapTestState.installAuthRuntimeTokenGetters,
  refreshAndPersistAuthToken:
    authRuntimeBootstrapTestState.refreshAndPersistAuthToken,
}));

vi.mock('./libs/openclawTokenProxy', () => ({
  startOpenClawTokenProxy: authRuntimeBootstrapTestState.startOpenClawTokenProxy,
}));

vi.mock('./libs/githubCopilotAuth', () => ({
  getCopilotToken: authRuntimeBootstrapTestState.getCopilotToken,
}));

vi.mock('./libs/copilotTokenManager', () => ({
  refreshCopilotTokenNow:
    authRuntimeBootstrapTestState.refreshCopilotTokenNow,
}));

import { bootstrapAuthRuntime } from './authRuntimeBootstrap';

describe('authRuntimeBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('boots auth refresh, copilot runtime, proxy refreshers, and OpenClaw token proxy using managed refresh helpers', async () => {
    const deps = {
      getStore: vi.fn().mockReturnValue({ id: 'store' }),
      getServerApiBaseUrl: vi.fn().mockReturnValue('https://api.example.com'),
      getAuthTokens: vi.fn().mockReturnValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
      saveAuthTokens: vi.fn(),
      getPendingTokenRefresh: vi.fn(),
      setPendingTokenRefresh: vi.fn(),
      syncOpenClawConfig: vi.fn(),
    };

    await bootstrapAuthRuntime(deps as never);

    expect(
      authRuntimeBootstrapTestState.createManagedAuthTokenRefresher,
    ).toHaveBeenCalledTimes(1);
    const refresherArgs =
      authRuntimeBootstrapTestState.createManagedAuthTokenRefresher.mock
        .calls[0]?.[0] as Record<string, unknown> | undefined;
    await expect(
      (
        refresherArgs?.fetchAuthRefresh as
          | ((url: string, init?: unknown) => Promise<unknown>)
          | undefined
      )?.('https://api.example.com/auth/refresh', { method: 'POST' }),
    ).resolves.toBeUndefined();
    expect(authRuntimeBootstrapTestState.fetch).toHaveBeenCalledWith(
      'https://api.example.com/auth/refresh',
      { method: 'POST' },
    );
    expect(refresherArgs).toMatchObject({
      getServerApiBaseUrl: deps.getServerApiBaseUrl,
      getAuthTokens: deps.getAuthTokens,
      saveAuthTokens: deps.saveAuthTokens,
      getPendingTokenRefresh: deps.getPendingTokenRefresh,
      setPendingTokenRefresh: deps.setPendingTokenRefresh,
      syncOpenClawConfig: deps.syncOpenClawConfig,
    });

    expect(
      authRuntimeBootstrapTestState.installAuthRuntimeTokenGetters,
    ).toHaveBeenCalledWith({
      getAuthTokens: deps.getAuthTokens,
      refreshToken: authRuntimeBootstrapTestState.refreshOnce,
      getServerApiBaseUrl: deps.getServerApiBaseUrl,
    });

    expect(
      authRuntimeBootstrapTestState.initializeCopilotRuntime,
    ).toHaveBeenCalledTimes(1);
    const copilotArgs =
      authRuntimeBootstrapTestState.initializeCopilotRuntime.mock.calls[0]?.[0] as
        | {
          getStore: () => unknown;
          loadCopilotToken: (githubToken: string) => Promise<string>;
        }
        | undefined;
    expect(copilotArgs?.getStore()).toEqual({ id: 'store' });
    await expect(copilotArgs?.loadCopilotToken('gh-token')).resolves.toBe(
      'copilot-token',
    );
    expect(authRuntimeBootstrapTestState.getCopilotToken).toHaveBeenCalledWith(
      'gh-token',
    );

    expect(
      authRuntimeBootstrapTestState.registerAuthProxyTokenRefreshers,
    ).toHaveBeenCalledTimes(1);
    const proxyRefreshers =
      authRuntimeBootstrapTestState.registerAuthProxyTokenRefreshers.mock
        .calls[0]?.[0] as
        | {
          refreshAgoraServerToken: () => Promise<unknown>;
          refreshGithubCopilotToken: () => Promise<unknown>;
        }
        | undefined;
    await expect(proxyRefreshers?.refreshAgoraServerToken()).resolves.toBe(
      'refreshed',
    );
    expect(
      authRuntimeBootstrapTestState.refreshAndPersistAuthToken,
    ).toHaveBeenCalledWith({
      fetchAuthRefresh: refresherArgs?.fetchAuthRefresh,
      getServerApiBaseUrl: deps.getServerApiBaseUrl,
      getAuthTokens: deps.getAuthTokens,
      saveAuthTokens: deps.saveAuthTokens,
      successMessage: '[Auth] proxy token refresh succeeded',
      failureMessage: '[Auth] proxy token refresh failed:',
    });
    await expect(proxyRefreshers?.refreshGithubCopilotToken()).resolves.toBe(
      'copilot-refresh',
    );
    expect(
      authRuntimeBootstrapTestState.refreshCopilotTokenNow,
    ).toHaveBeenCalledTimes(1);

    expect(authRuntimeBootstrapTestState.startOpenClawTokenProxy)
      .toHaveBeenCalledWith({
        getAuthTokens: deps.getAuthTokens,
        refreshToken: authRuntimeBootstrapTestState.refreshOnce,
        getServerBaseUrl: deps.getServerApiBaseUrl,
      });
  });

  it('continues when the OpenClaw token proxy fails to start', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    authRuntimeBootstrapTestState.startOpenClawTokenProxy.mockRejectedValueOnce(
      new Error('proxy-start-failed'),
    );
    const deps = {
      getStore: vi.fn().mockReturnValue({ id: 'store' }),
      getServerApiBaseUrl: vi.fn().mockReturnValue('https://api.example.com'),
      getAuthTokens: vi.fn().mockReturnValue(null),
      saveAuthTokens: vi.fn(),
      getPendingTokenRefresh: vi.fn(),
      setPendingTokenRefresh: vi.fn(),
      syncOpenClawConfig: vi.fn(),
    };

    await expect(bootstrapAuthRuntime(deps as never)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Main] OpenClaw token proxy failed to start (non-fatal):',
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
