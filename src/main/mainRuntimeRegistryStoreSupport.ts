import type { App } from 'electron';

import { CoworkStore } from './coworkStore';
import { SqliteStore } from './sqliteStore';

export interface MainRuntimeRegistryStoreSupportDeps {
  app: App;
}

export interface MainRuntimeRegistryStoreSupport {
  initStore: () => Promise<SqliteStore>;
  setStore: (nextStore: SqliteStore) => void;
  getStore: () => SqliteStore;
  getCoworkStore: () => CoworkStore;
}

export function createMainRuntimeRegistryStoreSupport(
  deps: MainRuntimeRegistryStoreSupportDeps,
): MainRuntimeRegistryStoreSupport {
  let store: SqliteStore | null = null;
  let coworkStore: CoworkStore | null = null;
  let storeInitPromise: Promise<SqliteStore> | null = null;

  const initStore = async (): Promise<SqliteStore> => {
    if (!storeInitPromise) {
      if (!deps.app.isReady()) {
        throw new Error('Store accessed before app is ready.');
      }
      storeInitPromise = Promise.race([
        Promise.resolve(SqliteStore.create(deps.app.getPath('userData'))),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Store initialization timed out after 15s')),
            15_000,
          ),
        ),
      ]);
    }
    return storeInitPromise;
  };

  const setStore = (nextStore: SqliteStore): void => {
    store = nextStore;
  };

  const getStore = (): SqliteStore => {
    if (!store) {
      throw new Error('Store not initialized. Call initStore() first.');
    }
    return store;
  };

  const getCoworkStore = (): CoworkStore => {
    if (!coworkStore) {
      const sqliteStore = getStore();
      coworkStore = new CoworkStore(sqliteStore.getDatabase());
      const cleaned = coworkStore.autoDeleteNonPersonalMemories();
      if (cleaned > 0) {
        console.info(
          `[cowork-memory] Auto-deleted ${cleaned} non-personal/procedural memories`,
        );
      }
    }
    return coworkStore;
  };

  return {
    initStore,
    setStore,
    getStore,
    getCoworkStore,
  };
}
