/**
 * Core module barrel export.
 * Unified entry point for all core layer modules.
 */

export { EngineRouter } from './EngineRouter';
export type { EngineRouterDeps } from './EngineRouter';

export { SessionManager } from './SessionManager';
export type { SessionRecord, CreateSessionOptions } from './SessionManager';

export { MessageStore } from './MessageStore';
export type { GetMessagesOptions, SQLiteMessageStoreAdapter } from './MessageStore';

export { PermissionManager } from './PermissionManager';
export type { PermissionManagerEvents } from './PermissionManager';

export { ConfigManager } from './ConfigManager';
export type { ConfigPersistenceAdapter } from './ConfigManager';

// Re-export core types
export type {
  CoworkRuntime,
  CoworkRuntimeEvents,
  CoworkStartOptions,
  CoworkContinueOptions,
  PermissionRequest,
  CoworkImageAttachment,
  CoworkRuntimeMetric,
} from './CoworkRuntime';
