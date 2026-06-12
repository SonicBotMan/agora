/**
 * Core type definitions for the Agora application.
 * Re-exports types from the agent engine layer and provides core-level extensions.
 */

// Re-export all types from the existing agent engine type definitions
export type {
  CoworkContinueOptions,
  CoworkImageAttachment,
  CoworkRuntime,
  CoworkRuntimeEvents,
  CoworkRuntimeMetric,
  CoworkStartOptions,
  PermissionRequest,
} from '../main/libs/agentEngine/types';

// Re-export value constants from agent engine types
export { ENGINE_SWITCHED_CODE } from '../main/libs/agentEngine/types';

// Re-export the CoworkAgentEngine type (also re-exported by agentEngine/types)
export type { CoworkAgentEngine } from '../main/libs/agentEngine/types';

// Re-export CoworkAgentEngine values and defaults from shared constants
export {
  CoworkAgentEngineValues as CoworkAgentEngineValueList,
  CoworkAgentEngine as CoworkAgentEngineValues,
  CoworkSessionKind,
  DefaultCoworkAgentEngine,
  RuntimeCallSource,
  RuntimeCallStatus,
} from '../shared/cowork/constants';

// Re-export types from shared constants
export type {
  CoworkSessionKind as CoworkSessionKindType,
  RuntimeCallSource as RuntimeCallSourceType,
  RuntimeCallStatus as RuntimeCallStatusType,
} from '../shared/cowork/constants';

// Re-export CoworkMessage from the normalized store type source
export type { CoworkMessage } from '../main/coworkStoreTypes';
