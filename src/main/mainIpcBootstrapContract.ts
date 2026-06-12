import type { AllHandlerDeps, AuthDeps } from './ipc';
import type { MainIpcCoreHandlerDeps } from './mainIpcCoreSupport';
import type { MainIpcRuntimeHandlerDeps } from './mainIpcRuntimeSupport';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type MainIpcAuthRuntimeDeps = Pick<
  AuthDeps,
  | 'ensureDesktopAuthCallbackUrl'
  | 'getPendingAuthCode'
  | 'setPendingAuthCode'
  | 'sendAuthCallback'
>;

type MainIpcPreAuthHandlerDeps = MainIpcCoreHandlerDeps
  & MainIpcRuntimeHandlerDeps;

export interface MainIpcBootstrapInputDeps {
  onNetworkOnline: () => void;
  handlers: MainIpcPreAuthHandlerDeps;
}

export interface MainIpcBootstrapDeps {
  onNetworkOnline: () => void;
  handlers: AllHandlerDeps;
}

export interface MainIpcBootstrapResult {
  getAuthTokens: () => AuthTokens | null;
  saveAuthTokens: (accessToken: string, refreshToken: string) => void;
}
