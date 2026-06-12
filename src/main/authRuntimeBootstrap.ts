import { net } from 'electron';

import type { AuthRuntimeBootstrapDeps } from './authRuntimeBootstrapContract';
import {
  initializeCopilotRuntime,
  registerAuthProxyTokenRefreshers,
} from './authRuntimeCopilotSupport';
import {
  type AuthRefreshFetch,
  createManagedAuthTokenRefresher,
  installAuthRuntimeTokenGetters,
  refreshAndPersistAuthToken,
} from './authRuntimeRefreshSupport';
import { startOpenClawTokenProxy } from './libs/openclawTokenProxy';

export type { AuthRuntimeBootstrapDeps } from './authRuntimeBootstrapContract';

export async function bootstrapAuthRuntime(
  deps: AuthRuntimeBootstrapDeps,
): Promise<void> {
  const fetchAuthRefresh: AuthRefreshFetch = async (url, init) =>
    await net.fetch(url, init);

  const refreshOnce = createManagedAuthTokenRefresher({
    fetchAuthRefresh,
    getServerApiBaseUrl: deps.getServerApiBaseUrl,
    getAuthTokens: deps.getAuthTokens,
    saveAuthTokens: deps.saveAuthTokens,
    getPendingTokenRefresh: deps.getPendingTokenRefresh,
    setPendingTokenRefresh: deps.setPendingTokenRefresh,
    syncOpenClawConfig: deps.syncOpenClawConfig,
  });

  installAuthRuntimeTokenGetters({
    getAuthTokens: deps.getAuthTokens,
    refreshToken: refreshOnce,
    getServerApiBaseUrl: deps.getServerApiBaseUrl,
  });

  initializeCopilotRuntime({
    getStore: deps.getStore,
    loadCopilotToken: async (githubToken: string) => {
      const { getCopilotToken } = await import('./libs/githubCopilotAuth');
      return await getCopilotToken(githubToken);
    },
  });

  registerAuthProxyTokenRefreshers({
    refreshAgoraServerToken: () =>
      refreshAndPersistAuthToken({
        fetchAuthRefresh,
        getServerApiBaseUrl: deps.getServerApiBaseUrl,
        getAuthTokens: deps.getAuthTokens,
        saveAuthTokens: deps.saveAuthTokens,
        successMessage: '[Auth] proxy token refresh succeeded',
        failureMessage: '[Auth] proxy token refresh failed:',
      }),
    refreshGithubCopilotToken: async () => {
      const { refreshCopilotTokenNow } = await import(
        './libs/copilotTokenManager'
      );
      return await refreshCopilotTokenNow();
    },
  });

  // Start the lightweight token proxy before OpenClaw config sync so that
  // agora-server provider can use the proxy URL in its config.
  try {
    await startOpenClawTokenProxy({
      getAuthTokens: deps.getAuthTokens,
      refreshToken: refreshOnce,
      getServerBaseUrl: deps.getServerApiBaseUrl,
    });
    console.log('[Main] OpenClaw token proxy started');
  } catch (error) {
    console.warn(
      '[Main] OpenClaw token proxy failed to start (non-fatal):',
      error,
    );
  }
}
