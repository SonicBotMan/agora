import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainBootstrapAppSupport', () => ({
  createAppCleanupDeps: vi.fn(),
  createAppStartupDeps: vi.fn(),
  createMainWindowBootstrapDeps: vi.fn(),
  createScheduledTaskStartupDeps: vi.fn(),
}));

vi.mock('./mainBootstrapIpcSupport', () => ({
  createMainIpcBootstrapDeps: vi.fn(),
}));

import {
  createAppCleanupDeps,
  createAppStartupDeps,
  createMainWindowBootstrapDeps,
  createScheduledTaskStartupDeps,
} from './mainBootstrapAppSupport';
import { createMainIpcBootstrapDeps } from './mainBootstrapIpcSupport';
import { createMainBootstrapWiring } from './mainBootstrapWiring';

describe('mainBootstrapWiring', () => {
  it('composes single-instance app bootstrap deps from wiring support', () => {
    const appCleanup = { cleanup: 'cleanup' };
    const appStartup = { startup: 'startup' };
    const mainWindow = { window: 'window' };
    const mainIpc = { ipc: 'ipc' };
    const scheduledTaskStartup = { scheduled: 'scheduled' };

    vi.mocked(createAppCleanupDeps).mockReturnValue(appCleanup as never);
    vi.mocked(createAppStartupDeps).mockReturnValue(appStartup as never);
    vi.mocked(createMainWindowBootstrapDeps).mockReturnValue(mainWindow as never);
    vi.mocked(createMainIpcBootstrapDeps).mockReturnValue(mainIpc as never);
    vi.mocked(createScheduledTaskStartupDeps).mockReturnValue(
      scheduledTaskStartup as never,
    );

    const app = { id: 'app' };
    const getMainWindow = vi.fn();
    const deps = {
      app,
      state: { getMainWindow },
      runtime: {},
    };

    const result = createMainBootstrapWiring(deps as never);

    expect(createMainIpcBootstrapDeps).toHaveBeenCalledWith(deps);
    expect(createScheduledTaskStartupDeps).toHaveBeenCalledWith(deps);
    expect(createMainWindowBootstrapDeps).toHaveBeenCalledWith(deps);
    expect(createAppCleanupDeps).toHaveBeenCalledWith(deps);
    expect(createAppStartupDeps).toHaveBeenCalledWith(deps);
    expect(result).toEqual({
      app,
      authProtocol: {
        app,
        getMainWindow,
      },
      mainIpc,
      scheduledTaskStartup,
      mainWindow,
      appCleanup,
      appStartup,
    });
  });
});
