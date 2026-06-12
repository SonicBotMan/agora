/**
 * Core ConfigManager façade.
 *
 * Re-export the SQLite-backed configuration manager used by the main Cowork
 * runtime so core consumers observe the real persisted config behavior.
 */

export {
  ConfigManager,
  normalizeCoworkAgentEngineValue,
} from '../main/core/configManager';
export type {
  CoworkConfig,
  CoworkConfigUpdate,
} from '../main/coworkStoreTypes';
