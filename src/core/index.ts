/**
 * Core module barrel export.
 * Unified entry point for all core layer modules.
 */

export type {
  AttachmentDialogOptions,
  AttachmentPathResult,
  AttachmentPathsResult,
  ReadFileAsDataUrlResult,
  SaveInlineFileOptions,
  SaveInlineFileResult,
  SaveLocalImageOptions,
  SaveLocalImageResult,
} from './AttachmentHandler';
export { AttachmentHandler } from './AttachmentHandler';
export type {
  CoworkConfig,
  CoworkConfigUpdate,
} from './ConfigManager';
export { ConfigManager } from './ConfigManager';
export {
  normalizeCoworkAgentEngineValue,
} from './ConfigManager';
export type { EngineRouterDeps } from './EngineRouter';
export { EngineRouter } from './EngineRouter';
export type {
  CoworkImportedMessageInput,
  CoworkMessage,
  CoworkMessageMetadata,
  CoworkMessageType,
} from './MessageStore';
export { MessageStore } from './MessageStore';
export type {
  PendingPermissionRecord,
  PermissionDismissedEvent,
  PermissionDismissReason,
  PermissionManagerEvents,
  PermissionResolutionAction,
  PermissionResolvedEvent,
} from './PermissionManager';
export { PermissionManager } from './PermissionManager';
export type {
  CoworkExecutionMode,
  CoworkImportedSessionInput,
  CoworkSession,
  CoworkSessionSummary,
  SessionManagerDeps,
} from './SessionManager';
export { SessionManager } from './SessionManager';

// Re-export core types
export type {
  CoworkContinueOptions,
  CoworkImageAttachment,
  CoworkRuntime,
  CoworkRuntimeEvents,
  CoworkRuntimeMetric,
  CoworkStartOptions,
  PermissionRequest,
} from './CoworkRuntime';
