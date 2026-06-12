import {
  initCopilotTokenManager,
  setCopilotTokenState,
} from './libs/copilotTokenManager';
import { registerProxyTokenRefresher } from './libs/coworkOpenAICompatProxy';
import type { SqliteStore } from './sqliteStore';

type CopilotTokenState = {
  copilotToken: string;
  baseUrl: string;
  expiresAt: number;
  githubToken: string;
};

type CopilotTokenExchange = {
  token: string;
  expiresAt: number;
  baseUrl: string;
};

interface InitializeCopilotRuntimeDeps {
  getStore: () => SqliteStore;
  loadCopilotToken: (
    githubToken: string,
  ) => Promise<CopilotTokenExchange>;
}

interface RegisterAuthProxyTokenRefreshersDeps {
  refreshAgoraServerToken: () => Promise<string | null>;
  refreshGithubCopilotToken: () => Promise<{ copilotToken: string }>;
}

export function initializeCopilotRuntime(
  deps: InitializeCopilotRuntimeDeps,
): void {
  initCopilotTokenManager(deps.getStore);

  const storedGithubToken = deps.getStore().get(
    'github_copilot_github_token',
  ) as string | undefined;
  if (!storedGithubToken) {
    return;
  }

  void deps.loadCopilotToken(storedGithubToken)
    .then(({ token, expiresAt, baseUrl }) => {
      const nextState: CopilotTokenState = {
        copilotToken: token,
        baseUrl,
        expiresAt,
        githubToken: storedGithubToken,
      };
      setCopilotTokenState(nextState);
      console.log('[Main] restored Copilot token state from stored GitHub token');
    })
    .catch((error) => {
      console.warn('[Main] failed to restore Copilot token on startup:', error);
    });
}

export function registerAuthProxyTokenRefreshers(
  deps: RegisterAuthProxyTokenRefreshersDeps,
): void {
  registerProxyTokenRefresher('agora-server', deps.refreshAgoraServerToken);

  registerProxyTokenRefresher('github-copilot', async () => {
    try {
      const refreshed = await deps.refreshGithubCopilotToken();
      return refreshed.copilotToken;
    } catch (error) {
      console.warn('[Auth] Copilot proxy token refresh failed:', error);
      return null;
    }
  });
}
