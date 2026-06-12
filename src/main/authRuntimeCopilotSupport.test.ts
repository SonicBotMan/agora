import { describe, expect, it, vi } from 'vitest';

vi.mock('./libs/copilotTokenManager', () => ({
  initCopilotTokenManager: vi.fn(),
  setCopilotTokenState: vi.fn(),
}));

vi.mock('./libs/coworkOpenAICompatProxy', () => ({
  registerProxyTokenRefresher: vi.fn(),
}));

import {
  initializeCopilotRuntime,
  registerAuthProxyTokenRefreshers,
} from './authRuntimeCopilotSupport';
import {
  initCopilotTokenManager,
  setCopilotTokenState,
} from './libs/copilotTokenManager';
import { registerProxyTokenRefresher } from './libs/coworkOpenAICompatProxy';

describe('authRuntimeCopilotSupport', () => {
  it('initializes copilot token manager and restores stored token state', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const getStore = () =>
      ({
        get: vi.fn().mockReturnValue('github-token'),
      }) as never;

    initializeCopilotRuntime({
      getStore,
      loadCopilotToken: vi.fn().mockResolvedValue({
        token: 'copilot-token',
        expiresAt: 123,
        baseUrl: 'https://copilot.example.com',
      }),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(initCopilotTokenManager).toHaveBeenCalledWith(getStore);
    expect(setCopilotTokenState).toHaveBeenCalledWith({
      copilotToken: 'copilot-token',
      baseUrl: 'https://copilot.example.com',
      expiresAt: 123,
      githubToken: 'github-token',
    });

    logSpy.mockRestore();
  });

  it('registers proxy token refreshers for agora server and github copilot', async () => {
    const serverRefresh = vi.fn().mockResolvedValue('server-token');
    const copilotRefresh = vi.fn().mockResolvedValue({
      copilotToken: 'copilot-token',
    });

    registerAuthProxyTokenRefreshers({
      refreshAgoraServerToken: serverRefresh,
      refreshGithubCopilotToken: copilotRefresh,
    });

    expect(registerProxyTokenRefresher).toHaveBeenCalledTimes(2);
    expect(registerProxyTokenRefresher).toHaveBeenNthCalledWith(
      1,
      'agora-server',
      serverRefresh,
    );

    const githubRefresher = vi.mocked(registerProxyTokenRefresher).mock.calls[1]?.[1];
    await expect(githubRefresher?.()).resolves.toBe('copilot-token');
  });
});
