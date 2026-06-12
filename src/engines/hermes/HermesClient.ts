/**
 * HermesClient facade.
 *
 * Re-exports Hermes engine manager and configuration utilities from the
 * implementation layer, providing a stable import path per the architecture spec.
 */

export type { HermesConfig } from '../../main/libs/hermesConfig';
export { parseHermesConfig, serializeHermesConfig } from '../../main/libs/hermesConfig';
export { HermesEngineManager } from '../../main/libs/hermesEngineManager';
