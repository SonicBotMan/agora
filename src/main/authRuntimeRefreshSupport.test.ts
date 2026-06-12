import { describe, expect, it, vi } from 'vitest';

vi.mock('./libs/claudeSettings', () => ({
  setAuthTokensGetter: vi.fn(),
  setServerBaseUrlGetter: vi.fn(),
}));

import {
  createManagedAuthTokenRefresher,
  fetchRefreshedAuthTokens,
  installAuthRuntimeTokenGetters,
  refreshAndPersistAuthToken,
} from './authRuntimeRefreshSupport';
import {
  setAuthTokensGetter,
  setServerBaseUrlGetter,
} from './libs/claudeSettings';

describe('authRuntimeRefreshSupport', () => {
  it('fetches refreshed auth tokens from server response', async () => {
    const fetchAuthRefresh = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          accessToken: 'next-access',
          refreshToken: 'next-refresh',
        },
      }),
    });

    await expect(
      fetchRefreshedAuthTokens(
        fetchAuthRefresh,
        'https://api.example.com',
        'old-refresh',
      ),
    ).resolves.toEqual({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });

    expect(fetchAuthRefresh).toHaveBeenCalledWith(
      'https://api.example.com/api/auth/refresh',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'old-refresh' }),
      },
    );
  });

  it('persists refreshed auth tokens and returns the new access token', async () => {
    const saveAuthTokens = vi.fn();
    const onRefreshSucceeded = vi.fn();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await refreshAndPersistAuthToken({
      fetchAuthRefresh: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: { accessToken: 'next-access' },
        }),
      }),
      getServerApiBaseUrl: () => 'https://api.example.com',
      getAuthTokens: () => ({
        accessToken: 'current-access',
        refreshToken: 'current-refresh',
      }),
      saveAuthTokens,
      successMessage: '[Auth] refreshed',
      failureMessage: '[Auth] failed:',
      onRefreshSucceeded,
    });

    expect(result).toBe('next-access');
    expect(saveAuthTokens).toHaveBeenCalledWith(
      'next-access',
      'current-refresh',
    );
    expect(onRefreshSucceeded).toHaveBeenCalledWith('next-access');

    logSpy.mockRestore();
  });

  it('deduplicates concurrent managed refresh attempts and clears pending state', async () => {
    let pendingPromise: Promise<string | null> | null = null;
    const setPendingTokenRefresh = vi.fn((promise: Promise<string | null> | null) => {
      pendingPromise = promise;
    });
    const syncOpenClawConfig = vi.fn().mockResolvedValue({ success: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchAuthRefresh = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: { accessToken: 'next-access' },
      }),
    });

    const refreshToken = createManagedAuthTokenRefresher({
      fetchAuthRefresh,
      getServerApiBaseUrl: () => 'https://api.example.com',
      getAuthTokens: () => ({
        accessToken: 'current-access',
        refreshToken: 'current-refresh',
      }),
      saveAuthTokens: vi.fn(),
      getPendingTokenRefresh: () => pendingPromise,
      setPendingTokenRefresh,
      syncOpenClawConfig,
    });

    const first = refreshToken('startup');
    const second = refreshToken('startup');

    await expect(first).resolves.toBe('next-access');
    await expect(second).resolves.toBe('next-access');
    expect(fetchAuthRefresh).toHaveBeenCalledTimes(1);
    expect(syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'token-refresh:startup',
      restartGatewayIfRunning: false,
    });
    expect(setPendingTokenRefresh).toHaveBeenLastCalledWith(null);

    logSpy.mockRestore();
  });

  it('installs auth getters and triggers proactive refresh for near-expiry tokens', () => {
    const refreshToken = vi.fn().mockResolvedValue('next-access');
    const accessToken = [
      'header',
      Buffer.from(
        JSON.stringify({ exp: Math.floor((Date.now() + 60_000) / 1000) }),
      ).toString('base64'),
      'signature',
    ].join('.');

    installAuthRuntimeTokenGetters({
      getAuthTokens: () => ({
        accessToken,
        refreshToken: 'refresh-token',
      }),
      refreshToken,
      getServerApiBaseUrl: () => 'https://api.example.com',
    });

    const authGetter = vi.mocked(setAuthTokensGetter).mock.calls[0]?.[0];
    const baseUrlGetter = vi.mocked(setServerBaseUrlGetter).mock.calls[0]?.[0];

    expect(authGetter?.()).toEqual({
      accessToken,
      refreshToken: 'refresh-token',
    });
    expect(refreshToken).toHaveBeenCalledWith('proactive');
    expect(baseUrlGetter?.()).toBe('https://api.example.com');
  });
});
