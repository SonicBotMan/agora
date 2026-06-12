import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainWindowBootstrap', () => ({
  createOrFocusMainWindow: vi.fn(),
}));

import { createOrFocusMainWindow } from './mainWindowBootstrap';
import {
  createAppStartupRuntimeDeps,
  createBootstrappedMainIpcDeps,
  createMainIpcAuthRuntimeDeps,
} from './singleInstanceAppBootstrapSupport';

describe('singleInstanceAppBootstrapSupport', () => {
  it('creates auth runtime deps that forward to the auth protocol runtime', () => {
    const authProtocolRuntime = {
      ensureDesktopAuthCallbackUrl: vi.fn().mockReturnValue('agora://callback'),
      getPendingAuthCode: vi.fn().mockReturnValue('pending-code'),
      setPendingAuthCode: vi.fn(),
      sendAuthCallback: vi.fn(),
    };

    const deps = createMainIpcAuthRuntimeDeps(authProtocolRuntime as never);

    expect(deps.ensureDesktopAuthCallbackUrl()).toBe('agora://callback');
    expect(deps.getPendingAuthCode()).toBe('pending-code');
    deps.setPendingAuthCode('next-code');
    deps.sendAuthCallback('auth-code');
    expect(authProtocolRuntime.setPendingAuthCode).toHaveBeenCalledWith(
      'next-code',
    );
    expect(authProtocolRuntime.sendAuthCallback).toHaveBeenCalledWith(
      'auth-code',
    );
  });

  it('merges auth runtime deps into main IPC bootstrap deps', () => {
    const mainIpcDeps = {
      onNetworkOnline: vi.fn(),
      handlers: {
        session: { id: 'session' },
        auth: {
          getStore: vi.fn(),
          existingAuthHandler: vi.fn(),
        },
      },
    };
    const authRuntimeDeps = {
      ensureDesktopAuthCallbackUrl: vi.fn(),
      getPendingAuthCode: vi.fn(),
      setPendingAuthCode: vi.fn(),
      sendAuthCallback: vi.fn(),
    };

    const deps = createBootstrappedMainIpcDeps(
      mainIpcDeps as never,
      authRuntimeDeps as never,
    );

    expect(deps.onNetworkOnline).toBe(mainIpcDeps.onNetworkOnline);
    expect(deps.handlers.session).toBe(mainIpcDeps.handlers.session);
    expect(deps.handlers.auth).toEqual({
      ...mainIpcDeps.handlers.auth,
      ...authRuntimeDeps,
    });
  });

  it('creates app startup deps with auth token accessors and main window wrappers', () => {
    const authProtocolRuntime = {
      setPendingAuthCode: vi.fn(),
    };
    const authTokenAccessors = {
      getAuthTokens: vi.fn(),
      saveAuthTokens: vi.fn(),
    };
    const deps = {
      appStartup: {
        app: { whenReady: vi.fn() },
        isDev: true,
      },
      mainWindow: {
        getMainWindow: vi.fn(),
      },
    };

    const runtimeDeps = createAppStartupRuntimeDeps(
      deps as never,
      authProtocolRuntime as never,
      authTokenAccessors,
    );

    expect(runtimeDeps.app).toBe(deps.appStartup.app);
    expect(runtimeDeps.isDev).toBe(true);
    expect(runtimeDeps.getAuthTokens).toBe(authTokenAccessors.getAuthTokens);
    expect(runtimeDeps.saveAuthTokens).toBe(authTokenAccessors.saveAuthTokens);
    expect(runtimeDeps.getMainWindow).toBe(deps.mainWindow.getMainWindow);

    runtimeDeps.createWindow();
    expect(createOrFocusMainWindow).toHaveBeenCalledWith(deps.mainWindow);

    runtimeDeps.setPendingAuthCode('pending-code');
    expect(authProtocolRuntime.setPendingAuthCode).toHaveBeenCalledWith(
      'pending-code',
    );
  });
});
