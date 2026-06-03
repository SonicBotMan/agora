/**
 * Settings — Model Tab · Provider List Sidebar
 *
 * Left column of the model configuration dialog. Renders a scrollable
 * list of all visible providers (built-in + custom), each row showing:
 *
 *   - provider icon + display name
 *   - "Custom" badge for user-added providers
 *   - delete (×) button (custom providers only, hover-revealed)
 *   - enable/disable toggle (greyed out until the API key is filled)
 *
 * Also owns the "Import / Export / Add Custom Provider" controls at the
 * top and bottom of the list. The hidden file input that powers the
 * import flow is exposed as a `importInputRef` ref so the parent can
 * trigger the file picker.
 *
 * All state (providers, active selection, import/export flags) and
 * callbacks (add/delete/toggle/import/export) are passed in by the
 * parent so the save/cancel footer in `Settings` can revert the
 * snapshot.
 */

import React from 'react';

import { isCustomProvider } from '../../../config';
import { i18nService } from '../../../services/i18n';
import CustomProviderIcon from '../../icons/providers/CustomProviderIcon';

/**
 * Local mirror of the `ProviderType` / `ProvidersConfig` / `ProviderConfig`
 * aliases that Settings.tsx defines inline. We redefine them here to keep
 * the tab self-contained; if Settings ever exports them, replace these
 * with imports from there. `ProviderType` is widened to `string` for
 * compatibility with custom provider keys (custom_1..custom_9) that
 * Settings adds at runtime.
 */
export type ProviderType = string;
export type ProviderConfig = {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  displayName?: string;
  [key: string]: unknown;
};
export type ProvidersConfig = Record<string, ProviderConfig>;

export interface ProviderMetaEntry {
  label: string;
  icon: React.ReactNode;
}

export interface ProviderListSidebarProps {
  // Data
  visibleProviders: ProvidersConfig;
  providers: ProvidersConfig;
  providerMeta: Record<ProviderType, ProviderMetaEntry>;
  customProviderKeys: readonly string[];
  activeProvider: ProviderType;

  // Refs (for the hidden file input)
  importInputRef: React.RefObject<HTMLInputElement>;

  // Loading flags
  isImportingProviders: boolean;
  isExportingProviders: boolean;

  // Handlers
  handleProviderChange: (provider: ProviderType) => void;
  handleAddCustomProvider: () => void;
  handleDeleteCustomProvider: (provider: ProviderType) => void;
  toggleProviderEnabled: (provider: ProviderType) => void;
  handleImportProvidersClick: () => void;
  handleImportProviders: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleExportProviders: () => void;

  // Helpers
  providerRequiresApiKey: (provider: ProviderType) => boolean;
}

export const ProviderListSidebar: React.FC<ProviderListSidebarProps> = ({
  visibleProviders,
  providers,
  providerMeta,
  customProviderKeys,
  activeProvider,
  importInputRef,
  isImportingProviders,
  isExportingProviders,
  handleProviderChange,
  handleAddCustomProvider,
  handleDeleteCustomProvider,
  toggleProviderEnabled,
  handleImportProvidersClick,
  handleImportProviders,
  handleExportProviders,
  providerRequiresApiKey,
}) => {
  return (
    <div className="w-2/5 border-r border-border pr-3 space-y-1.5 overflow-y-auto">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-medium text-foreground">
          {i18nService.t('modelProviders')}
        </h3>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleImportProvidersClick}
            disabled={isImportingProviders || isExportingProviders}
            className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-lg border border-border text-foreground hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            {i18nService.t('import')}
          </button>
          <button
            type="button"
            onClick={handleExportProviders}
            disabled={isImportingProviders || isExportingProviders}
            className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-lg border border-border text-foreground hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            {i18nService.t('export')}
          </button>
        </div>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportProviders}
      />
      {Object.entries(visibleProviders).map(([provider, config]) => {
        const providerKey = provider as ProviderType;
        const isCustom = isCustomProvider(provider);
        const providerInfo = providerMeta[providerKey];
        const missingApiKey =
          providerRequiresApiKey(providerKey) && !(config.apiKey ?? '').trim();
        const canToggleProvider = config.enabled || !missingApiKey;
        const displayLabel = isCustom
          ? (config as ProviderConfig).displayName || providerKey
          : providerInfo?.label ?? providerKey;
        return (
          <div
            key={provider}
            onClick={() => handleProviderChange(providerKey)}
            className={`group flex items-center p-2 rounded-xl cursor-pointer transition-colors ${
              activeProvider === provider
                ? 'bg-primary-muted border border-primary shadow-subtle'
                : 'bg-surface hover:bg-surface-raised border border-transparent'
            }`}
          >
            <div className="flex flex-1 items-center min-w-0">
              <div className="mr-2 flex h-7 w-7 items-center justify-center shrink-0">
                <span className="text-foreground">
                  {isCustom ? <CustomProviderIcon /> : providerInfo?.icon}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-sm font-medium truncate ${
                    activeProvider === provider
                      ? 'text-primary'
                      : 'text-foreground'
                  }`}
                >
                  {displayLabel}
                </span>
                {isCustom && (
                  <span className="text-[9px] leading-tight mt-0.5 text-primary">
                    {i18nService.t('customBadge')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center ml-2 gap-1">
              {isCustom && (
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-claude-secondaryText hover:text-red-500 dark:text-claude-darkSecondaryText dark:hover:text-red-400 p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCustomProvider(providerKey);
                  }}
                  title={i18nService.t('deleteCustomProvider')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
              <div
                title={
                  !canToggleProvider ? i18nService.t('configureApiKey') : undefined
                }
                className={`w-7 h-4 rounded-full flex items-center transition-colors ${
                  config.enabled ? 'bg-primary' : 'bg-gray-400 dark:bg-gray-600'
                } ${
                  canToggleProvider
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed opacity-50'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canToggleProvider) {
                    return;
                  }
                  toggleProviderEnabled(providerKey);
                }}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform ${
                    config.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </div>
          </div>
        );
      })}
      {/* Add Custom Provider Button */}
      {customProviderKeys.some((k) => !providers[k as ProviderType]) && (
        <button
          type="button"
          onClick={handleAddCustomProvider}
          className="w-full flex items-center justify-center p-2 rounded-xl border border-dashed border-claude-border dark:border-claude-darkBorder text-claude-secondaryText dark:text-claude-darkSecondaryText hover:border-claude-accent hover:text-claude-accent transition-colors text-sm"
        >
          {i18nService.t('addCustomProvider')}
        </button>
      )}
    </div>
  );
};
