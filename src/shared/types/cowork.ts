/**
 * Shared cowork types re-exported from the canonical definitions.
 *
 * Both main and renderer processes can import from here instead of reaching
 * into src/main/coworkStoreTypes directly.
 */

export type {
  CoworkExecutionMode,
  CoworkMessage,
  CoworkMessageMetadata,
  CoworkMessageType,
  CoworkSession,
  CoworkSessionStatus,
  CoworkSessionSummary,
} from '../../main/coworkStoreTypes';
