import type { CronJobService } from '../scheduled-task/cronJobService';
import type { SqliteStore } from './sqliteStore';

export interface MainWindowReadyLifecycleDeps {
  emitWindowState: () => void;
  isAutoLaunched: () => boolean;
  getAppLanguage: () => string | undefined;
  setLanguage: (language: 'en' | 'zh') => void;
  createTray: () => void;
  getCronJobService: () => CronJobService;
  getStore: () => SqliteStore;
  getOpenClawStateDir: () => string;
}
