/**
 * Core SessionManager façade.
 *
 * Re-export the SQLite-backed session manager used by the main Cowork store
 * so the core layer exposes the real session lifecycle behavior.
 */

export type { SessionManagerDeps } from '../main/core/sessionManager';
export { SessionManager } from '../main/core/sessionManager';
export type {
  CoworkExecutionMode,
  CoworkImportedSessionInput,
  CoworkSession,
  CoworkSessionSummary,
} from '../main/coworkStoreTypes';
