import { describe, expect, it, vi } from 'vitest';

vi.mock('./authProtocolLifecycle', () => ({
  registerAuthProtocolLifecycle: vi.fn(),
}));

vi.mock('./mainIpcBootstrap', () => ({
  registerMainIpcBootstrap: vi.fn(),
}));

vi.mock('./scheduledTaskStartupBootstrap', () => ({
  bootstrapScheduledTaskStartup: vi.fn(),
}));

vi.mock('./appCleanupLifecycle', () => ({
  registerAppCleanupLifecycle: vi.fn(),
}));

vi.mock('./appShutdownCleanup', () => ({
  runAppShutdownCleanup: vi.fn(),
}));

vi.mock('./appStartupBootstrap', () => ({
  bootstrapAppStartup: vi.fn(),
}));

vi.mock('./appWindowLifecycle', () => ({
  registerWindowAllClosedLifecycle: vi.fn(),
}));

import { registerAppCleanupLifecycle } from './appCleanupLifecycle';
import { runAppShutdownCleanup } from './appShutdownCleanup';
import { bootstrapAppStartup } from './appStartupBootstrap';
import { registerWindowAllClosedLifecycle } from './appWindowLifecycle';
import { registerAuthProtocolLifecycle } from './authProtocolLifecycle';
import { registerMainIpcBootstrap } from './mainIpcBootstrap';
import { bootstrapScheduledTaskStartup } from './scheduledTaskStartupBootstrap';
import { runSingleInstanceAppBootstrap } from './singleInstanceAppBootstrapRuntimeSupport';

describe('singleInstanceAppBootstrapRuntimeSupport', () => {
  it('wires auth protocol runtime into IPC and app startup orchestration', async () => {
    const authProtocolRuntime = {
      ensureDesktopAuthCallbackUrl: vi.fn().mockReturnValue('agora://callback'),
      getPendingAuthCode: vi.fn().mockReturnValue('pending'),
      setPendingAuthCode: vi.fn(),
      sendAuthCallback: vi.fn(),
    };
    vi.mocked(registerAuthProtocolLifecycle).mockReturnValue(
      authProtocolRuntime as never,
    );
    vi.mocked(registerMainIpcBootstrap).mockReturnValue({
      getAuthTokens: vi.fn(),
      saveAuthTokens: vi.fn(),
    });
    vi.mocked(bootstrapAppStartup).mockResolvedValue(undefined);

    const deps = {
      app: { name: 'app' },
      authProtocol: { name: 'auth' },
      mainIpc: {
        onNetworkOnline: vi.fn(),
        handlers: {
          auth: {
            getStore: vi.fn(),
          },
        },
      },
      scheduledTaskStartup: { name: 'scheduled' },
      mainWindow: {
        getMainWindow: vi.fn(),
      },
      appCleanup: {
        markQuitting: vi.fn(),
        shutdown: { name: 'shutdown' },
      },
      appStartup: {
        createWindow: vi.fn(),
      },
    } as never;

    runSingleInstanceAppBootstrap(deps);

    expect(registerAuthProtocolLifecycle).toHaveBeenCalledWith(deps.authProtocol);
    expect(registerMainIpcBootstrap).toHaveBeenCalled();
    const ipcDeps = vi.mocked(registerMainIpcBootstrap).mock.calls[0]?.[0];
    expect(ipcDeps?.handlers.auth.ensureDesktopAuthCallbackUrl()).toBe(
      'agora://callback',
    );
    expect(bootstrapScheduledTaskStartup).toHaveBeenCalledWith(
      deps.scheduledTaskStartup,
    );
    expect(registerAppCleanupLifecycle).toHaveBeenCalled();
    const cleanupDeps = vi.mocked(registerAppCleanupLifecycle).mock.calls[0]?.[0];
    cleanupDeps?.runCleanup();
    expect(runAppShutdownCleanup).toHaveBeenCalledWith(deps.appCleanup.shutdown);
    expect(bootstrapAppStartup).toHaveBeenCalled();
    const startupDeps = vi.mocked(bootstrapAppStartup).mock.calls[0]?.[0];
    startupDeps?.setPendingAuthCode('next-code');
    expect(authProtocolRuntime.setPendingAuthCode).toHaveBeenCalledWith(
      'next-code',
    );
    expect(registerWindowAllClosedLifecycle).toHaveBeenCalledWith(deps.app);
  });
});
