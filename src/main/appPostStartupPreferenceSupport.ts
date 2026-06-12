import { powerSaveBlocker } from 'electron';

import type {
  AppConfigSettings,
  AppPostStartupLifecycleDeps,
} from './appPostStartupLifecycleContract';
import { normalizeMainLanguage } from './i18nSupport';
import type { SqliteStore } from './sqliteStore';

type PreventSleepStarter = (type: 'prevent-display-sleep') => number;

type AppConfigLifecycleDeps = Pick<
  AppPostStartupLifecycleDeps,
  | 'getMainWindow'
  | 'getUseSystemProxyFromConfig'
  | 'applyProxyPreference'
  | 'getOpenClawEngineManager'
  | 'updateTitleBarOverlay'
  | 'setLanguage'
  | 'updateTrayMenu'
>;

type AppConfigLifecycleState = {
  lastLanguage: AppConfigSettings['language'] | undefined;
  lastUseSystemProxy: boolean;
};

export function applyInitialAppPreferences(
  store: SqliteStore,
  setAutoLaunchEnabled: AppPostStartupLifecycleDeps['setAutoLaunchEnabled'],
  startPreventSleep: PreventSleepStarter = (type) =>
    powerSaveBlocker.start(type),
): void {
  if (!store.get('auto_launch_initialized')) {
    store.set('auto_launch_initialized', true);
    store.set('auto_launch_enabled', true);
    setAutoLaunchEnabled(true);
  }

  const preventSleepEnabled = store.get<boolean>('prevent_sleep_enabled');
  if (preventSleepEnabled) {
    try {
      startPreventSleep('prevent-display-sleep');
    } catch (error) {
      console.error('[Main] Failed to start prevent-sleep blocker:', error);
    }
  }
}

export function createAppConfigChangeHandler(
  deps: AppConfigLifecycleDeps,
  state: AppConfigLifecycleState,
): (
  newConfig: AppConfigSettings | undefined,
  oldConfig: AppConfigSettings | undefined,
) => void {
  return (newConfig, oldConfig): void => {
    deps.updateTitleBarOverlay();

    const currentLanguage = newConfig?.language;
    if (currentLanguage !== state.lastLanguage) {
      state.lastLanguage = currentLanguage;
      deps.setLanguage(normalizeMainLanguage(currentLanguage));
      deps.updateTrayMenu(deps.getMainWindow);
    }

    const previousUseSystemProxy = oldConfig
      ? deps.getUseSystemProxyFromConfig(oldConfig)
      : state.lastUseSystemProxy;
    const currentUseSystemProxy = deps.getUseSystemProxyFromConfig(newConfig);
    if (currentUseSystemProxy !== previousUseSystemProxy) {
      void deps.applyProxyPreference(currentUseSystemProxy).then(() => {
        if (deps.getOpenClawEngineManager().getStatus().phase === 'running') {
          void deps.getOpenClawEngineManager().restartGateway();
        }
      });
    }
    state.lastUseSystemProxy = currentUseSystemProxy;
  };
}

export function registerAppConfigLifecycle(
  deps: AppConfigLifecycleDeps,
  store: SqliteStore,
): void {
  const initialConfig = store.get<AppConfigSettings>('app_config');
  const state: AppConfigLifecycleState = {
    lastLanguage: initialConfig?.language,
    lastUseSystemProxy: deps.getUseSystemProxyFromConfig(initialConfig),
  };

  store.onDidChange<AppConfigSettings>(
    'app_config',
    createAppConfigChangeHandler(deps, state),
  );
}
