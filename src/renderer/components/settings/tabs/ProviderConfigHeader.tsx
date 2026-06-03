/**
 * Settings — Model Tab · Provider Config Header
 *
 * Top section of the model tab's right panel. Renders three things:
 *
 *   1. The provider's display name (custom or built-in).
 *   2. An "external link" icon button that opens the official site
 *      when one is configured in `providerLinks`.
 *   3. A status pill (green "on" / red "off") reflecting
 *      `providers[activeProvider].enabled`.
 *
 * All data is read-only at this level — the parent decides what
 * happens when the user toggles the provider (that lives in
 * ProviderListSidebar, not here).
 */

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import React from 'react';

import { i18nService } from '../../../services/i18n';

export interface ProviderConfigHeaderProps {
  /** Display name shown next to "Provider settings" — custom or built-in. */
  providerName: string;
  /** Absolute URL of the provider's official site, if known. */
  websiteUrl: string | undefined;
  /** Whether the provider is currently enabled. */
  enabled: boolean;
}

export const ProviderConfigHeader: React.FC<ProviderConfigHeaderProps> = ({
  providerName,
  websiteUrl,
  enabled,
}) => {
  return (
    <div className="flex items-center justify-between pb-2 border-b border-border">
      <div className="flex items-center gap-1.5">
        <h3 className="text-base font-medium text-foreground">
          {providerName} {i18nService.t('providerSettings')}
        </h3>
        {websiteUrl && (
          <button
            type="button"
            onClick={() => void window.electron.shell.openExternal(websiteUrl)}
            className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
            title={i18nService.t('visitOfficialSite')}
            aria-label={i18nService.t('visitOfficialSite')}
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <div
        className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
          enabled
            ? 'bg-green-500/20 text-green-600 dark:text-green-400'
            : 'bg-red-500/20 text-red-600 dark:text-red-400'
        }`}
      >
        {enabled ? i18nService.t('providerStatusOn') : i18nService.t('providerStatusOff')}
      </div>
    </div>
  );
};
