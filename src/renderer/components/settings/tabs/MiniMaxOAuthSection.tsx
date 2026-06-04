/**
 * Settings — Model Tab · MiniMax OAuth Section
 *
 * Implements the MiniMax provider's two authentication flows:
 *
 *   1. **API key mode** — a single API key input (same shape as
 *      ApiKeySection but inlined because the toggle tab sits in
 *      this component too).
 *   2. **OAuth mode** — a device-code flow with the four phases:
 *        - `idle` + no apiKey        → "Sign in" button
 *        - `requesting`              → spinner
 *        - `awaiting_user`           → user code + verification URL
 *        - `success`                 → "Connected" pill + sign-out
 *
 * The parent owns the authType toggle, the apiKey, and all the
 * phase state. The component is a pure renderer with all side
 * effects passed in as callbacks.
 */

import { EyeIcon, EyeSlashIcon, XCircleIcon as XCircleIconSolid } from '@heroicons/react/20/solid';
import React from 'react';

import { i18nService } from '../../../services/i18n';

/** Mirrors Settings.tsx's `MiniMaxOAuthPhase` discriminated union. */
export type MiniMaxOAuthPhase =
  | { kind: 'idle' }
  | { kind: 'requesting_code' }
  | { kind: 'pending'; userCode: string; verificationUri: string }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export interface MiniMaxOAuthSectionProps {
  // Mode toggle
  isOAuthMode: boolean;
  onSelectOAuth: () => void;
  onSelectApiKey: () => void;

  // API key mode
  apiKey: string;
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  onApiKeyChange: (value: string) => void;
  apiKeyLink: string | undefined;

  // OAuth mode
  phase: MiniMaxOAuthPhase;
  hasApiKey: boolean;
  onSignIn: () => void;
  onCancel: () => void;
  onSignOut: () => void;
}

export const MiniMaxOAuthSection: React.FC<MiniMaxOAuthSectionProps> = ({
  isOAuthMode,
  onSelectOAuth,
  onSelectApiKey,
  apiKey,
  showApiKey,
  setShowApiKey,
  onApiKeyChange,
  apiKeyLink,
  phase,
  hasApiKey,
  onSignIn,
  onCancel,
  onSignOut,
}) => {
  return (
    <div className="space-y-3">
      {/* Auth type tabs */}
      <div>
        <div className="flex rounded-xl overflow-hidden border border-border mb-3">
          <button
            type="button"
            onClick={onSelectOAuth}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              isOAuthMode
                ? 'bg-primary text-white'
                : 'text-secondary hover:bg-surface-raised'
            }`}
          >
            {i18nService.t('minimaxOAuthTabOAuth')}
          </button>
          <button
            type="button"
            onClick={onSelectApiKey}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              !isOAuthMode
                ? 'bg-primary text-white'
                : 'text-secondary hover:bg-surface-raised'
            }`}
          >
            {i18nService.t('minimaxOAuthTabApiKey')}
          </button>
        </div>
      </div>

      {/* API Key mode */}
      {!isOAuthMode && (
        <div className="min-h-[68px]">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="minimax-apiKey"
              className="block text-xs font-medium dark:text-claude-darkText text-claude-text"
            >
              {i18nService.t('apiKey')}
            </label>
            {apiKeyLink && (
              <button
                type="button"
                onClick={() => void window.electron.shell.openExternal(apiKeyLink)}
                className="text-[11px] text-claude-accent hover:underline transition-colors"
              >
                {i18nService.t('getApiKey')} →
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              id="minimax-apiKey"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 pr-16 text-xs"
              placeholder={i18nService.t('apiKeyPlaceholder')}
            />
            <div className="absolute right-2 inset-y-0 flex items-center gap-1">
              {apiKey && (
                <button
                  type="button"
                  onClick={() => onApiKeyChange('')}
                  className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                  title={i18nService.t('clear') || 'Clear'}
                >
                  <XCircleIconSolid className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                title={
                  showApiKey
                    ? i18nService.t('hide') || 'Hide'
                    : i18nService.t('show') || 'Show'
                }
              >
                {showApiKey ? (
                  <EyeIcon className="h-4 w-4" />
                ) : (
                  <EyeSlashIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OAuth mode */}
      {isOAuthMode && (
        <div className="space-y-2 min-h-[68px]">
          {phase.kind === 'idle' && !hasApiKey && (
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors"
            >
              {i18nService.t('minimaxOAuthLogin')}
            </button>
          )}

          {phase.kind === 'idle' && hasApiKey && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 space-y-2">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                {i18nService.t('minimaxOAuthLoggedIn')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-surface-raised transition-colors"
                >
                  {i18nService.t('minimaxOAuthLogout')}
                </button>
              </div>
            </div>
          )}

          {phase.kind === 'requesting_code' && (
            <div className="flex items-center gap-2 text-xs text-secondary">
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
              {i18nService.t('minimaxOAuthRequesting')}
            </div>
          )}

          {phase.kind === 'pending' && (
            <div className="p-3 rounded-xl bg-surface-inset border border-border space-y-2">
              <p className="text-xs text-foreground font-medium">
                {i18nService.t('minimaxOAuthOpenBrowserHint')}
              </p>
              <div>
                <span className="text-[11px] text-secondary">
                  {i18nService.t('minimaxOAuthUserCode')}:&nbsp;
                </span>
                <code className="text-xs font-mono text-primary">
                  {phase.userCode}
                </code>
              </div>
              <a
                href={phase.verificationUri}
                onClick={(e) => {
                  e.preventDefault();
                  void window.electron.shell.openExternal(phase.verificationUri);
                }}
                className="block text-[11px] text-primary underline truncate"
              >
                {phase.verificationUri}
              </a>
              <p className="text-[11px] text-secondary">
                {i18nService.t('minimaxOAuthStatusPending')}
              </p>
              <button
                type="button"
                onClick={onCancel}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border text-foreground hover:bg-surface-raised transition-colors"
              >
                {i18nService.t('minimaxOAuthCancel')}
              </button>
            </div>
          )}

          {phase.kind === 'success' && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 space-y-2">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                {i18nService.t('minimaxOAuthSuccess')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-surface-raised transition-colors"
                >
                  {i18nService.t('minimaxOAuthLogout')}
                </button>
              </div>
            </div>
          )}

          {phase.kind === 'error' && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {phase.message}
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-surface-raised transition-colors"
              >
                {i18nService.t('retry')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
