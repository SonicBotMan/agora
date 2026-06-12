import { describe, expect, it, vi } from 'vitest';

vi.mock('./libs/pythonRuntime', () => ({
  ensurePythonRuntimeReady: vi.fn(),
}));

vi.mock('./skillServices', () => ({
  getSkillServiceManager: vi.fn(),
}));

import { ensurePythonRuntimeReady } from './libs/pythonRuntime';
import {
  initializeRuntimeSkillManager,
  initializeRuntimeSkillServices,
} from './runtimeSkillStartupSkillSupport';
import { getSkillServiceManager } from './skillServices';

describe('runtimeSkillStartupSkillSupport', () => {
  it('initializes skill manager and registers skill change resync', async () => {
    const onSkillsChanged = vi.fn();
    const manager = {
      onSkillsChanged,
      syncBundledSkillsToUserData: vi.fn(),
      recoverInterruptedUpgrades: vi.fn(),
      startWatching: vi.fn(),
    };

    initializeRuntimeSkillManager({
      getSkillManager: () => manager,
      syncOpenClawConfig: vi.fn().mockResolvedValue({ success: true }),
    });

    expect(onSkillsChanged).toHaveBeenCalledTimes(1);
    expect(manager.syncBundledSkillsToUserData).toHaveBeenCalled();
    expect(manager.recoverInterruptedUpgrades).toHaveBeenCalled();
    expect(manager.startWatching).toHaveBeenCalled();
  });

  it('starts python runtime and skill services', async () => {
    vi.mocked(ensurePythonRuntimeReady).mockResolvedValue({
      success: true,
    } as never);
    const startAll = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getSkillServiceManager).mockReturnValue({
      startAll,
    } as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initializeRuntimeSkillServices();

    expect(ensurePythonRuntimeReady).toHaveBeenCalled();
    expect(getSkillServiceManager).toHaveBeenCalled();
    expect(startAll).toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
