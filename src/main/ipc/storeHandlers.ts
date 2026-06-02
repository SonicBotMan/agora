/**
 * Agora — Store IPC Handlers
 * Persistent configuration via electron-store / conf.
 */

import { ipcMain } from 'electron';

export interface StoreDeps {
  getStore: <T = unknown>(key: string, defaultValue?: T) => T;
  setStore: (key: string, value: unknown) => void;
  deleteStoreKey: (key: string) => void;
}

export function registerStoreHandlers(deps: StoreDeps): void {
  ipcMain.handle('store:get', (_event, key: string, defaultValue?: unknown) => {
    return deps.getStore(key, defaultValue);
  });

  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    deps.setStore(key, value);
  });

  ipcMain.handle('store:delete', (_event, key: string) => {
    deps.deleteStoreKey(key);
  });
}
