/**
 * Agora — Store IPC Handlers
 * Persistent configuration via electron-store / conf.
 */

import { ipcMain } from 'electron';

export interface StoreDeps {
  getStore: <T = unknown>(key: string, defaultValue?: T) => T;
  setStore: (key: string, value: unknown) => void;
  deleteStoreKey: (key: string) => void;
  /**
   * Called after `store:set` when the key is `'app_config'`.
   * Maps to the side effects in main.ts:
   *   - refreshEndpointsTestMode(getStore())
   *   - syncOpenClawConfig({ reason: 'app-config-change', restartGatewayIfRunning: false })
   */
  onAppConfigChanged?: () => Promise<void>;
}

export function registerStoreHandlers(deps: StoreDeps): void {
  ipcMain.handle('store:get', (_event, key: string) => {
    return deps.getStore(key);
  });

  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    deps.setStore(key, value);
    if (key === 'app_config') {
      await deps.onAppConfigChanged?.();
    }
  });

  ipcMain.handle('store:remove', (_event, key: string) => {
    deps.deleteStoreKey(key);
  });
}
