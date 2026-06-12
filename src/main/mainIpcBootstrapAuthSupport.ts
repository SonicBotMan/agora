import type { AllHandlerDeps } from './ipc';
import type {
  AuthTokens,
  MainIpcBootstrapResult,
} from './mainIpcBootstrapContract';

type AuthStoreAccessor = Pick<AllHandlerDeps['auth'], 'getStore'>;

export function createMainIpcAuthTokenAccessors(
  auth: AuthStoreAccessor,
): MainIpcBootstrapResult {
  return {
    saveAuthTokens: (accessToken: string, refreshToken: string): void => {
      auth.getStore().set('auth_tokens', {
        accessToken,
        refreshToken,
      });
    },
    getAuthTokens: (): AuthTokens | null => {
      return auth.getStore().get<AuthTokens>('auth_tokens') || null;
    },
  };
}
