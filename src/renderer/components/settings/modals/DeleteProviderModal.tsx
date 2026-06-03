/**
 * Settings — Delete Provider Confirmation Modal
 *
 * Tiny confirm dialog shown when the user clicks the (×) button next
 * to a custom provider in the model tab sidebar. Two actions:
 *
 *   - Cancel: dismisses the modal and clears `pendingDeleteProvider`.
 *   - Confirm: invokes the parent's `confirmDeleteCustomProvider`
 *     callback which actually mutates the providers store.
 *
 * The modal is mounted inline (not via Portal) so it inherits the
 * Settings dialog's rounded corners and theming.
 */

import React from 'react';

import { i18nService } from '../../../services/i18n';

export interface DeleteProviderModalProps {
  /** Called when the user confirms deletion. */
  onConfirm: () => void;
  /** Called when the user dismisses (Cancel button or backdrop click). */
  onCancel: () => void;
}

export const DeleteProviderModal: React.FC<DeleteProviderModalProps> = ({
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl dark:bg-claude-darkSurface bg-claude-bg dark:border-claude-darkBorder border-claude-border border shadow-modal p-4"
      >
        <p className="text-sm dark:text-claude-darkText text-claude-text">
          {i18nService.t('confirmDeleteCustomProvider')}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border dark:border-claude-darkBorder border-claude-border dark:text-claude-darkText text-claude-text dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors active:scale-[0.98]"
          >
            {i18nService.t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors active:scale-[0.98]"
          >
            {i18nService.t('deleteCustomProvider')}
          </button>
        </div>
      </div>
    </div>
  );
};
