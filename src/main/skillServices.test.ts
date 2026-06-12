import { app } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/Users/tester'),
    getAppPath: vi.fn().mockReturnValue('/app'),
  },
}));

vi.mock('./libs/coworkUtil', () => ({
  getElectronNodeRuntimePath: vi.fn().mockReturnValue('/electron/node'),
}));

vi.mock('./libs/pythonRuntime', () => ({
  appendPythonRuntimeToEnv: vi.fn(),
}));

vi.mock('./skillServicesSupport', () => ({
  buildSkillServiceEnv: vi.fn().mockReturnValue({ PATH: '/usr/bin' }),
  hasCommand: vi.fn(),
  isWebSearchDistOutdated: vi.fn(),
  isWebSearchRuntimeHealthy: vi.fn(),
  resolveBundledWebSearchRepairPath: vi.fn(),
  resolveNodeRuntime: vi.fn(),
  resolveUserShellPath: vi.fn(),
  resolveWebSearchPath: vi.fn(),
}));

import { getSkillServiceManager, SkillServiceManager } from './skillServices';
import { buildSkillServiceEnv } from './skillServicesSupport';

describe('skillServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildSkillServiceEnv).mockReturnValue({ PATH: '/usr/bin' });
  });

  it('builds the shared skill service env and starts the web-search service', async () => {
    const manager = new SkillServiceManager();
    const startWebSearchService = vi
      .spyOn(manager, 'startWebSearchService')
      .mockResolvedValue(undefined);

    await manager.startAll();

    expect(buildSkillServiceEnv).toHaveBeenCalledWith(
      expect.objectContaining({
        processEnv: process.env,
        isPackaged: app.isPackaged,
        homePath: '/Users/tester',
        electronNodeRuntimePath: '/electron/node',
      }),
    );
    expect(startWebSearchService).toHaveBeenCalledTimes(1);
  });

  it('swallows start errors after logging them', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const manager = new SkillServiceManager();
    vi.spyOn(manager, 'startWebSearchService').mockRejectedValue(
      new Error('failed to start'),
    );

    await manager.startAll();

    expect(errorSpy).toHaveBeenCalledWith(
      '[SkillServices] Error starting services:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it('stops the web-search service through the manager lifecycle', async () => {
    const manager = new SkillServiceManager();
    const stopWebSearchService = vi
      .spyOn(manager, 'stopWebSearchService')
      .mockResolvedValue(undefined);

    await manager.stopAll();

    expect(stopWebSearchService).toHaveBeenCalledTimes(1);
  });

  it('returns a stable singleton skill service manager instance', () => {
    expect(getSkillServiceManager()).toBe(getSkillServiceManager());
  });
});
