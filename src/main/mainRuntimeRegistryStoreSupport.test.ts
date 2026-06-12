import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mainRuntimeRegistryStoreSupportTestState = vi.hoisted(() => {
  const sqliteStoreCreate = vi.fn();
  const coworkStoreInstances: Array<{
    database: unknown;
    autoDeleteNonPersonalMemories: ReturnType<typeof vi.fn>;
    getDatabase: ReturnType<typeof vi.fn>;
  }> = [];

  class MockCoworkStore {
    database: unknown;
    autoDeleteNonPersonalMemories: ReturnType<typeof vi.fn>;
    getDatabase: ReturnType<typeof vi.fn>;

    constructor(database: unknown) {
      this.database = database;
      this.autoDeleteNonPersonalMemories = vi.fn().mockReturnValue(2);
      this.getDatabase = vi.fn().mockReturnValue(database);
      coworkStoreInstances.push(this);
    }
  }

  return {
    sqliteStoreCreate,
    coworkStoreInstances,
    MockCoworkStore,
  };
});

vi.mock('./sqliteStore', () => ({
  SqliteStore: {
    create: mainRuntimeRegistryStoreSupportTestState.sqliteStoreCreate,
  },
}));

vi.mock('./coworkStore', () => ({
  CoworkStore: mainRuntimeRegistryStoreSupportTestState.MockCoworkStore,
}));

import { createMainRuntimeRegistryStoreSupport } from './mainRuntimeRegistryStoreSupport';

describe('mainRuntimeRegistryStoreSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainRuntimeRegistryStoreSupportTestState.coworkStoreInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes and caches the sqlite store only after the app is ready', async () => {
    const store = {
      getDatabase: vi.fn().mockReturnValue('db'),
    };
    const app = {
      isReady: vi.fn().mockReturnValue(true),
      getPath: vi.fn().mockReturnValue('/tmp/agora-user-data'),
    };

    mainRuntimeRegistryStoreSupportTestState.sqliteStoreCreate.mockReturnValue(
      store,
    );

    const support = createMainRuntimeRegistryStoreSupport({ app } as never);

    await expect(support.initStore()).resolves.toBe(store);
    await expect(support.initStore()).resolves.toBe(store);
    expect(
      mainRuntimeRegistryStoreSupportTestState.sqliteStoreCreate,
    ).toHaveBeenCalledTimes(1);
    expect(
      mainRuntimeRegistryStoreSupportTestState.sqliteStoreCreate,
    ).toHaveBeenCalledWith('/tmp/agora-user-data');

    expect(() => support.getStore()).toThrow(
      'Store not initialized. Call initStore() first.',
    );
    support.setStore(store as never);
    expect(support.getStore()).toBe(store);
  });

  it('rejects store initialization before app readiness and on startup timeout', async () => {
    const notReadyApp = {
      isReady: vi.fn().mockReturnValue(false),
      getPath: vi.fn(),
    };
    const pendingApp = {
      isReady: vi.fn().mockReturnValue(true),
      getPath: vi.fn().mockReturnValue('/tmp/agora-user-data'),
    };
    const pendingStore = new Promise(() => {});

    mainRuntimeRegistryStoreSupportTestState.sqliteStoreCreate
      .mockReset()
      .mockReturnValueOnce(pendingStore);

    const notReady = createMainRuntimeRegistryStoreSupport({
      app: notReadyApp,
    } as never);
    const pending = createMainRuntimeRegistryStoreSupport({
      app: pendingApp,
    } as never);

    await expect(notReady.initStore()).rejects.toThrow(
      'Store accessed before app is ready.',
    );

    vi.useFakeTimers();
    const timeoutPromise = pending.initStore();
    const timeoutAssertion = expect(timeoutPromise).rejects.toThrow(
      'Store initialization timed out after 15s',
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await timeoutAssertion;
  });

  it('lazily creates cowork store once and logs auto-cleanup when memories were removed', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const store = {
      getDatabase: vi.fn().mockReturnValue('db'),
    };
    const app = {
      isReady: vi.fn().mockReturnValue(true),
      getPath: vi.fn().mockReturnValue('/tmp/agora-user-data'),
    };
    const support = createMainRuntimeRegistryStoreSupport({ app } as never);

    support.setStore(store as never);

    const firstCoworkStore = support.getCoworkStore();
    const secondCoworkStore = support.getCoworkStore();

    expect(firstCoworkStore).toBe(secondCoworkStore);
    expect(
      mainRuntimeRegistryStoreSupportTestState.coworkStoreInstances,
    ).toHaveLength(1);
    expect(
      mainRuntimeRegistryStoreSupportTestState.coworkStoreInstances[0]?.database,
    ).toBe('db');
    expect(infoSpy).toHaveBeenCalledWith(
      '[cowork-memory] Auto-deleted 2 non-personal/procedural memories',
    );

    infoSpy.mockRestore();
  });
});
