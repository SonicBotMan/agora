import type { AppStartupBootstrapDeps } from './appStartupBootstrap';
import type { AuthProtocolRuntime } from './authProtocolLifecycle';
import type {
  MainIpcAuthRuntimeDeps,
  MainIpcBootstrapDeps,
  MainIpcBootstrapResult,
} from './mainIpcBootstrap';
import { createOrFocusMainWindow } from './mainWindowBootstrap';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrapContract';

type AuthTokenAccessors = {
  getAuthTokens: MainIpcBootstrapResult['getAuthTokens'];
  saveAuthTokens: MainIpcBootstrapResult['saveAuthTokens'];
};

export function createMainIpcAuthRuntimeDeps(
  authProtocolRuntime: AuthProtocolRuntime,
): MainIpcAuthRuntimeDeps {
  return {
    ensureDesktopAuthCallbackUrl: () =>
      authProtocolRuntime.ensureDesktopAuthCallbackUrl(),
    getPendingAuthCode: () => authProtocolRuntime.getPendingAuthCode(),
    setPendingAuthCode: (code) => authProtocolRuntime.setPendingAuthCode(code),
    sendAuthCallback: (code) => authProtocolRuntime.sendAuthCallback(code),
  };
}

export function createBootstrappedMainIpcDeps(
  deps: SingleInstanceAppBootstrapDeps['mainIpc'],
  authRuntimeDeps: MainIpcAuthRuntimeDeps,
): MainIpcBootstrapDeps {
  return {
    ...deps,
    handlers: {
      ...deps.handlers,
      auth: {
        ...deps.handlers.auth,
        ...authRuntimeDeps,
      },
    },
  };
}

export function createAppStartupRuntimeDeps(
  deps: SingleInstanceAppBootstrapDeps,
  authProtocolRuntime: AuthProtocolRuntime,
  authTokenAccessors: AuthTokenAccessors,
): AppStartupBootstrapDeps {
  return {
    ...deps.appStartup,
    ...authTokenAccessors,
    getMainWindow: deps.mainWindow.getMainWindow,
    createWindow: () => {
      createOrFocusMainWindow(deps.mainWindow);
    },
    setPendingAuthCode: (code: string | null) =>
      authProtocolRuntime.setPendingAuthCode(code),
  };
}
