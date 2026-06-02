/**
 * Agora — Auth IPC Handlers
 * User authentication, API key management, provider credentials.
 */

import { ipcMain } from 'electron';

export interface AuthProvider {
  id: string;
  name: string;
  type: 'oauth' | 'apikey' | 'token';
  enabled: boolean;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  provider: string;
  expiresAt?: string;
}

export interface AuthDeps {
  login: (provider: string, credentials?: Record<string, string>) => Promise<AuthStatus>;
  logout: () => Promise<void>;
  getAuthStatus: () => Promise<AuthStatus>;
  getProviders: () => AuthProvider[];
  getApiKey: (provider: string) => string | null;
  setApiKey: (provider: string, key: string) => Promise<void>;
  deleteApiKey: (provider: string) => Promise<void>;
  listApiKeys: () => Promise<{ provider: string; hasKey: boolean; maskedKey?: string }[]>;
  refreshToken: (provider: string) => Promise<AuthStatus>;
  validateApiKey: (provider: string, key: string) => Promise<{ valid: boolean; error?: string }>;
}

export function registerAuthHandlers(deps: AuthDeps): void {
  ipcMain.handle('auth:login', async (_event, provider: string, credentials?: Record<string, string>) => {
    return deps.login(provider, credentials);
  });

  ipcMain.handle('auth:logout', async () => {
    await deps.logout();
  });

  ipcMain.handle('auth:getStatus', async () => {
    return deps.getAuthStatus();
  });

  ipcMain.handle('auth:getProviders', () => {
    return deps.getProviders();
  });

  ipcMain.handle('auth:getApiKey', (_event, provider: string) => {
    return deps.getApiKey(provider);
  });

  ipcMain.handle('auth:setApiKey', async (_event, provider: string, key: string) => {
    await deps.setApiKey(provider, key);
  });

  ipcMain.handle('auth:deleteApiKey', async (_event, provider: string) => {
    await deps.deleteApiKey(provider);
  });

  ipcMain.handle('auth:listApiKeys', async () => {
    return deps.listApiKeys();
  });

  ipcMain.handle('auth:refreshToken', async (_event, provider: string) => {
    return deps.refreshToken(provider);
  });

  ipcMain.handle('auth:validateKey', async (_event, provider: string, key: string) => {
    return deps.validateApiKey(provider, key);
  });

  ipcMain.handle('auth:enableProvider', async (_event, providerId: string) => {
    // noop placeholder — actual enable logic wired to store
  });

  ipcMain.handle('auth:disableProvider', async (_event, providerId: string) => {
    // noop placeholder
  });

  ipcMain.handle('auth:testConnection', async (_event, provider: string) => {
    const key = deps.getApiKey(provider);
    if (!key) return { success: false, error: 'No API key configured' };
    return deps.validateApiKey(provider, key);
  });

  ipcMain.handle('auth:oauthCallback', async (_event, _code: string, _state: string) => {
    // OAuth callback placeholder — wired during OAuth flow setup
    return { success: false, error: 'OAuth not yet implemented' };
  });

  ipcMain.handle('auth:getOAuthUrl', (_event, provider: string) => {
    // Return OAuth authorization URL for provider
    return null;
  });
}
