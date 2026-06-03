/**
 * Settings — Test Result Modal
 *
 * Overlays the Settings dialog to display the outcome of a provider
 * connection test. Renders a small modal with:
 *   - The provider name (looked up from `providerMeta`).
 *   - A green check / red cross indicating success or failure.
 *   - The detailed message returned by the test (latency, error, etc.).
 *   - A single "Close" button.
 *
 * The modal is mounted inline as part of the Settings dialog (not via
 * React Portal) so it inherits the same dark/light theming and the
 * rounded corners of the parent surface.
 */

import { CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import React from 'react';

import { i18nService } from '../../../services/i18n';

export interface TestResultModalProps {
  /** Display name of the provider being reported. */
  providerLabel: string | undefined;
  /** Whether the test connection succeeded. */
  success: boolean;
  /** Human-readable result message (latency, error, etc.). */
  message: string;
  /** Close the modal. */
  onClose: () => void;
}

export const TestResultModal: React.FC<TestResultModalProps> = ({
  providerLabel,
  success,
  message,
  onClose,
}) => {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={i18nService.t('connectionTestResult')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-background border-border border shadow-modal p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">
            {i18nService.t('connectionTestResult')}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-secondary hover:text-foreground rounded-md hover:bg-surface-raised"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-secondary">
          <span>{providerLabel ?? '?'}</span>
          <span className="text-[11px]">•</span>
          <span
            className={`inline-flex items-center gap-1 ${
              success
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {success ? (
              <CheckCircleIcon className="h-4 w-4" />
            ) : (
              <XCircleIcon className="h-4 w-4" />
            )}
            {success
              ? i18nService.t('connectionSuccess')
              : i18nService.t('connectionFailed')}
          </span>
        </div>

        <p className="mt-3 text-xs leading-5 text-foreground whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
          {message}
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-surface-raised transition-colors active:scale-[0.98]"
          >
            {i18nService.t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
