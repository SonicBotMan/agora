/**
 * Core type definitions for the Agora application.
 * Re-exports types from the agent engine layer and provides core-level extensions.
 */

// Re-export all types from the existing agent engine type definitions
export type {
  CoworkRuntime,
  CoworkRuntimeEvents,
  CoworkStartOptions,
  CoworkContinueOptions,
  PermissionRequest,
  CoworkImageAttachment,
  CoworkRuntimeMetric,
} from '../main/libs/agentEngine/types';

// Re-export value constants from agent engine types
export { ENGINE_SWITCHED_CODE } from '../main/libs/agentEngine/types';

// Re-export the CoworkAgentEngine type (also re-exported by agentEngine/types)
export type { CoworkAgentEngine } from '../main/libs/agentEngine/types';

// Re-export CoworkAgentEngine values and defaults from shared constants
export {
  CoworkAgentEngine as CoworkAgentEngineValues,
  DefaultCoworkAgentEngine,
  CoworkAgentEngineValues as CoworkAgentEngineValueList,
  RuntimeCallStatus,
  RuntimeCallSource,
  CoworkSessionKind,
} from '../shared/cowork/constants';

// Re-export types from shared constants
export type {
  RuntimeCallStatus as RuntimeCallStatusType,
  RuntimeCallSource as RuntimeCallSourceType,
  CoworkSessionKind as CoworkSessionKindType,
} from '../shared/cowork/constants';

// Re-export CoworkMessage type from the main store
export type { CoworkMessage } from '../main/coworkStore';
