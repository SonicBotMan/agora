import { net, protocol } from 'electron';
import fs from 'fs';
import os from 'os';

import {
  ensureDefaultProjectDirectory,
  registerLocalfileProtocol,
  resetStartupRuntimeState,
} from './coreAppStartupBootstrapSupport';
import { setStoreGetter } from './libs/claudeSettings';
import { refreshEndpointsTestMode } from './libs/endpoints';
import type { SqliteStore } from './sqliteStore';

export interface CoreAppStartupBootstrapDeps {
  initStore: () => Promise<SqliteStore>;
  getCoworkStore: () => {
    resetRunningSessions: () => number;
  };
  getRuntimeTelemetryStore: () => {
    resetRunningCalls: () => number;
  };
}

export async function bootstrapCoreAppStartup(
  deps: CoreAppStartupBootstrapDeps,
): Promise<SqliteStore> {
  const { initStore, getCoworkStore, getRuntimeTelemetryStore } = deps;

  ensureDefaultProjectDirectory(os.homedir(), fs);
  registerLocalfileProtocol(protocol, net);

  console.log('[Main] initApp: starting initStore()');
  const store = await initStore();
  console.log('[Main] initApp: store initialized');
  refreshEndpointsTestMode(store);

  resetStartupRuntimeState({
    getCoworkStore,
    getRuntimeTelemetryStore,
  });

  setStoreGetter(() => store);
  return store;
}
