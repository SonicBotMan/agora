import type { BrowserWindow } from 'electron';

import {
  migrateScheduledTaskRunsToOpenclaw,
  migrateScheduledTasksToOpenclaw,
} from '../scheduled-task/migrate';
import { normalizeMainLanguage } from './i18nSupport';
import type { MainWindowReadyLifecycleDeps } from './mainWindowReadyLifecycleContract';

async function startScheduledTaskRuntime(
  deps: Pick<
    MainWindowReadyLifecycleDeps,
    'getCronJobService' | 'getStore' | 'getOpenClawStateDir'
  >,
): Promise<void> {
  try {
    deps.getCronJobService().startPolling();
  } catch (error) {
    console.warn(
      '[Main] CronJobService not available yet, will start polling when OpenClaw is ready:',
      error,
    );
  }

  const store = deps.getStore();

  void migrateScheduledTasksToOpenclaw({
    db: store.getDatabase(),
    getKv: (key) => store.get(key),
    setKv: (key, value) => store.set(key, value),
    cronJobService: deps.getCronJobService(),
  }).catch((error) => {
    console.warn('[Main] Scheduled tasks migration failed:', error);
  });

  void migrateScheduledTaskRunsToOpenclaw({
    db: store.getDatabase(),
    getKv: (key) => store.get(key),
    setKv: (key, value) => store.set(key, value),
    openclawStateDir: deps.getOpenClawStateDir(),
  }).catch((error) => {
    console.warn('[Main] Scheduled task run history migration failed:', error);
  });
}

export function registerMainWindowReadyLifecycle(
  window: BrowserWindow,
  deps: MainWindowReadyLifecycleDeps,
): void {
  window.once('ready-to-show', () => {
    deps.emitWindowState();

    if (!deps.isAutoLaunched()) {
      window.show();
    }
    deps.setLanguage(normalizeMainLanguage(deps.getAppLanguage()));
    deps.createTray();

    void startScheduledTaskRuntime(deps);
  });
}
