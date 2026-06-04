/**
 * Settings — Model Tab · Standard API Key Section
 *
 * Renders the API key input for non-MiniMax providers. Two slightly
 * different layouts share the same component:
 *
 *   - Generic (non-Qwen): the input id and the change handler both
 *     reference `activeProvider` (typed as `string` for compatibility
 *     with custom providers).
 *   - Qwen: the input is hard-coded to `qwen-apiKey` and uses
 *     `providers.qwen.apiKey` directly. Functionally identical — kept
 *     as a branch to avoid touching the Qwen-specific oauth flow.
 *
 * Both inputs support a password-style `showApiKey` toggle (eye icon)
 * and a clear (×) button when the field is non-empty.
 *
 * The MiniMax API key lives in a separate component (MiniMax OAuth
 * section) because it is paired with device-code authentication.
 */

import { EyeIcon, EyeSlashIcon } from '@heroicons/react/20/solid';
import { XCircleIcon as XCircleIconSolid } from '@heroicons/react/20/solid';
import React from 'react';

import { i18nService } from '../../../services/i18n';

export interface ApiKeySectionProps {
  /** The currently selected provider, as a string (literal union widened). */
  activeProvider: string;
  /** Current API key value for the selected provider. */
  apiKey: string;
  /** Setter for `showApiKey` — toggles password masking. */
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  /** Called with the new API key value. */
  onChange: (value: string) => void;
  /** Optional link to the provider's API key management page. */
  apiKeyLink: string | undefined;
}

export const ApiKeySection: React.FC<ApiKeySectionProps> = ({
  activeProvider,
  apiKey,
  showApiKey,
  setShowApiKey,
  onChange,
  apiKeyLink,
}) => {
  const inputId = `${activeProvider}-apiKey`;
  const isQwen = activeProvider === 'qwen';
  const labelText = isQwen ? 'API Key' : i18nService.t('apiKey');

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label
          htmlFor={inputId}
          className="block text-xs font-medium dark:text-claude-darkText text-claude-text"
        >
          {labelText}
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
          id={inputId}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-xl bg-claude-surfaceInset dark:bg-claude-darkSurfaceInset dark:border-claude-darkBorder border-claude-border border focus:border-claude-accent focus:ring-1 focus:ring-claude-accent/30 dark:text-claude-darkText text-claude-text px-3 py-2 pr-16 text-xs"
          placeholder={i18nService.t('apiKeyPlaceholder')}
        />
        <div className="absolute right-2 inset-y-0 flex items-center gap-1">
          {apiKey && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-0.5 rounded text-claude-textSecondary dark:text-claude-darkTextSecondary hover:text-claude-accent transition-colors"
              title={i18nService.t('clear') || 'Clear'}
            >
              <XCircleIconSolid className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowApiKey((prev) => !prev)}
            className="p-0.5 rounded text-claude-textSecondary dark:text-claude-darkTextSecondary hover:text-claude-accent transition-colors"
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
  );
};
