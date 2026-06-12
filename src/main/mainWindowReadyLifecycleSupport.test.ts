import { describe, expect, it, vi } from 'vitest';

vi.mock('../scheduled-task/migrate', () => ({
  migrateScheduledTasksToOpenclaw: vi.fn().mockResolvedValue(undefined),
  migrateScheduledTaskRunsToOpenclaw: vi.fn().mockResolvedValue(undefined),
}));

import {
  migrateScheduledTaskRunsToOpenclaw,
  migrateScheduledTasksToOpenclaw,
} from '../scheduled-task/migrate';
import { registerMainWindowReadyLifecycle } from './mainWindowReadyLifecycleSupport';

describe('mainWindowReadyLifecycleSupport', () => {
  it('normalizes the app language and starts tray/scheduled task bootstrap on ready-to-show', () => {
    const readyListeners = new Map<string, () => void>();
    const window = {
      once: vi.fn((event: string, listener: () => void) => {
        readyListeners.set(event, listener);
      }),
      show: vi.fn(),
    };
    const cronJobService = {
      startPolling: vi.fn(),
    };
    const store = {
      getDatabase: vi.fn().mockReturnValue('db'),
      get: vi.fn(),
      set: vi.fn(),
    };
    const deps = {
      emitWindowState: vi.fn(),
      isAutoLaunched: vi.fn().mockReturnValue(false),
      getAppLanguage: vi.fn().mockReturnValue('fr'),
      setLanguage: vi.fn(),
      createTray: vi.fn(),
      getCronJobService: vi.fn().mockReturnValue(cronJobService),
      getStore: vi.fn().mockReturnValue(store),
      getOpenClawStateDir: vi.fn().mockReturnValue('/openclaw'),
    };

    registerMainWindowReadyLifecycle(window as never, deps as never);
    readyListeners.get('ready-to-show')?.();

    expect(deps.emitWindowState).toHaveBeenCalledTimes(1);
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(deps.setLanguage).toHaveBeenCalledWith('zh');
    expect(deps.createTray).toHaveBeenCalledTimes(1);
    expect(cronJobService.startPolling).toHaveBeenCalledTimes(1);
    expect(migrateScheduledTasksToOpenclaw).toHaveBeenCalledWith({
      db: 'db',
      getKv: expect.any(Function),
      setKv: expect.any(Function),
      cronJobService,
    });
    expect(migrateScheduledTaskRunsToOpenclaw).toHaveBeenCalledWith({
      db: 'db',
      getKv: expect.any(Function),
      setKv: expect.any(Function),
      openclawStateDir: '/openclaw',
    });
  });
});
