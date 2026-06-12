/**
 * Core MessageStore façade.
 *
 * Re-export the SQLite-backed implementation used by the main-process
 * Cowork store so the core layer exposes the same behavior instead of a
 * divergent in-memory placeholder.
 */

export { MessageStore } from '../main/core/messageStore';
export type {
  CoworkImportedMessageInput,
  CoworkMessage,
  CoworkMessageMetadata,
  CoworkMessageType,
} from '../main/coworkStoreTypes';
