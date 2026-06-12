import {
  type DialogDeps,
  registerDialogHandlers,
} from '../main/ipc/dialogHandlers';

export type AttachmentDeps = DialogDeps;

/**
 * Top-level architecture facade for attachment-related dialogs.
 *
 * The real implementation lives in `src/main/ipc/dialogHandlers.ts`, which
 * owns file selection, save, and preview style flows.
 */
export function registerAttachmentHandlers(deps: AttachmentDeps): void {
  registerDialogHandlers(deps);
}
