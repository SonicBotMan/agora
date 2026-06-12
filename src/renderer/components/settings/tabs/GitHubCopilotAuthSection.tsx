/**
 * Settings — Model Tab · GitHub Copilot Auth Section
 *
 * Implements the device-code OAuth flow for the `github-copilot`
 * provider. The component is a pure renderer of the four auth states
 * tracked by the parent (`idle/error`, `requesting`, `awaiting_user`
 * or `polling`, `authenticated`). All side effects (calling the IPC
 * handlers, copying codes to clipboard, opening the verification
 * URL, signing out) are passed in as callbacks.
 *
 * The state machine:
 *
 *   idle / error   → "Sign in with GitHub" button
 *   requesting     → spinner + "Requesting code…"
 *   awaiting_user  → big user code + verification URL + "Waiting…"
 *   polling        → (same UI as awaiting_user, just different status)
 *   authenticated  → green dot + username + "Sign out" button
 */

import React from 'react';

import { i18nService } from '../../../services/i18n';
import GitHubCopilotIcon from '../../icons/providers/GitHubCopilotIcon';

export type CopilotAuthStatus =
  | 'idle'
  | 'requesting'
  | 'awaiting_user'
  | 'polling'
  | 'authenticated'
  | 'error';

export interface GitHubCopilotAuthSectionProps {
  status: CopilotAuthStatus;
  /** The user code shown to the user during device-code auth. */
  userCode: string;
  /** The verification URL the user must visit. */
  verificationUri: string;
  /** GitHub username once authenticated. */
  githubUser: string;
  /** True if the provider already has an apiKey (e.g. persisted from a
   *  previous session). Drives the "connected" pill visibility. */
  hasApiKey: boolean;
  /** Error message from the most recent auth attempt. */
  errorMessage: string | null;

  // Handlers
  onSignIn: () => void;
  onCancel: () => void;
  onSignOut: () => void;
}

export const GitHubCopilotAuthSection: React.FC<GitHubCopilotAuthSectionProps> = ({
  status,
  userCode,
  verificationUri,
  githubUser,
  hasApiKey,
  errorMessage,
  onSignIn,
  onCancel,
  onSignOut,
}) => {
  const showSignIn =
    (status === 'idle' || status === 'error') && !hasApiKey;

  const showRequesting = status === 'requesting';

  const showDeviceCode =
    status === 'awaiting_user' || status === 'polling';

  const showConnected =
    (status === 'authenticated' || hasApiKey) &&
    status !== 'requesting' &&
    status !== 'awaiting_user' &&
    status !== 'polling';

  return (
    <div>
      <label className="block text-xs font-medium dark:text-claude-darkText text-claude-text mb-2">
        {i18nService.t('githubCopilotAuth')}
      </label>

      {showSignIn && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onSignIn}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-claude-accent text-white text-xs font-medium hover:bg-claude-accent/90 transition-colors"
          >
            <GitHubCopilotIcon className="w-4 h-4" />
            {i18nService.t('githubCopilotSignIn')}
          </button>
          {errorMessage && (
            <p className="text-xs text-red-500 dark:text-red-400">
              {errorMessage}
            </p>
          )}
        </div>
      )}

      {showRequesting && (
        <div className="flex items-center gap-2 text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {i18nService.t('githubCopilotRequesting')}
        </div>
      )}

      {showDeviceCode && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-claude-surfaceInset dark:bg-claude-darkSurfaceInset border border-claude-border dark:border-claude-darkBorder">
            <p className="text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary mb-2">
              {i18nService.t('githubCopilotEnterCode')}
            </p>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-bold tracking-widest dark:text-claude-darkText text-claude-text">
                {userCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(userCode);
                }}
                className="px-2 py-0.5 rounded text-[10px] text-claude-textSecondary dark:text-claude-darkTextSecondary hover:text-claude-accent border border-claude-border dark:border-claude-darkBorder transition-colors"
              >
                {i18nService.t('copy') || 'Copy'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => window.electron.shell.openExternal(verificationUri)}
              className="mt-2 text-xs text-claude-accent hover:underline"
            >
              {verificationUri}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary">
              <svg
                className="animate-spin h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {i18nService.t('githubCopilotWaiting')}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary hover:text-red-500 transition-colors"
            >
              {i18nService.t('cancel')}
            </button>
          </div>
        </div>
      )}

      {showConnected && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-claude-surfaceInset dark:bg-claude-darkSurfaceInset border border-claude-border dark:border-claude-darkBorder">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs dark:text-claude-darkText text-claude-text">
              {githubUser
                ? `${i18nService.t('githubCopilotConnected')} @${githubUser}`
                : i18nService.t('githubCopilotConnected')}
            </span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary hover:text-red-500 transition-colors"
          >
            {i18nService.t('githubCopilotSignOut')}
          </button>
        </div>
      )}
    </div>
  );
};
