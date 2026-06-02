/**
 * ConfigManager — global key-value configuration store.
 *
 * Provides get, set, getAll, and reset operations backed by an in-memory Map.
 * Designed with a persistence interface that can be extended to support
 * file-based or SQLite-backed storage.
 */

/**
 * Configuration persistence adapter interface.
 * Implement this to persist configuration to disk or database.
 */
export interface ConfigPersistenceAdapter {
  load(): Record<string, string>;
  save(config: Record<string, string>): void;
}

/**
 * ConfigManager — simple key-value configuration store.
 *
 * Default implementation uses in-memory storage with an optional
 * persistence adapter for saving/loading configuration.
 */
export class ConfigManager {
  private readonly config: Map<string, string> = new Map();
  private persistenceAdapter: ConfigPersistenceAdapter | null = null;

  /**
   * Creates a new ConfigManager, optionally seeding with initial values.
   */
  constructor(initialValues?: Record<string, string>) {
    if (initialValues) {
      for (const [key, value] of Object.entries(initialValues)) {
        this.config.set(key, value);
      }
    }
  }

  /**
   * Retrieves a configuration value by key. Returns null if not found.
   */
  get(key: string): string | null {
    return this.config.get(key) ?? null;
  }

  /**
   * Sets a configuration value.
   */
  set(key: string, value: string): void {
    this.config.set(key, value);
  }

  /**
   * Returns a snapshot of all configuration entries.
   */
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.config.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Resets the configuration to an empty state or to the given initial values.
   */
  reset(initialValues?: Record<string, string>): void {
    this.config.clear();
    if (initialValues) {
      for (const [key, value] of Object.entries(initialValues)) {
        this.config.set(key, value);
      }
    }
  }

  // --- Persistence hooks (reserved for future use) ---

  /**
   * Binds a persistence adapter and loads saved configuration.
   */
  bindPersistenceAdapter(adapter: ConfigPersistenceAdapter): void {
    this.persistenceAdapter = adapter;
    const loaded = this.persistenceAdapter.load();
    for (const [key, value] of Object.entries(loaded)) {
      this.config.set(key, value);
    }
  }

  /**
   * Persists the current configuration using the bound adapter.
   */
  persist(): void {
    if (this.persistenceAdapter) {
      this.persistenceAdapter.save(this.getAll());
    }
  }
}
