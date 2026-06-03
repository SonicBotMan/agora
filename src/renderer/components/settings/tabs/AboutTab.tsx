/**
 * Settings — About Tab
 *
 * App metadata, version, contact email, user manual, community link,
 * log export, and the test-mode easter egg (click the logo 10 times).
 *
 * Service-terms and GitHub-link handlers are inlined via
 * `window.electron.shell.openExternal` so the parent doesn't have to
 * pass an extra prop for each.
 */

import React, { useState } from 'react';

import { i18nService } from '../../../services/i18n';
import ErrorMessage from '../../ErrorMessage';
import type { EnterpriseConfig, UpdateCheckStatus } from '../types';

export interface AboutTabProps {
  // Display state
  appVersion: string;
  enterpriseConfig?: EnterpriseConfig | null;

  // Test-mode easter egg
  testMode: boolean;
  setTestMode: React.Dispatch<React.SetStateAction<boolean>>;
  testModeUnlocked: boolean;
  setTestModeUnlocked: React.Dispatch<React.SetStateAction<boolean>>;

  // Update check
  updateCheckStatus: UpdateCheckStatus;
  handleCheckUpdate: () => Promise<void> | void;

  // Contact / manual / community / log export
  emailCopied: boolean;
  handleCopyContactEmail: () => Promise<void> | void;
  handleOpenUserManual: () => void;
  handleOpenUserCommunity: () => void;
  handleExportLogs: () => Promise<void> | void;
  isExportingLogs: boolean;

  // Constants
  aboutContactEmail: string;
  aboutUserManualUrl: string;
  aboutUserCommunityUrl: string;
  aboutServiceTermsUrl: string;

  // Error / notice display
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export const AboutTab: React.FC<AboutTabProps> = ({
  appVersion,
  enterpriseConfig,
  testMode,
  setTestMode,
  testModeUnlocked,
  setTestModeUnlocked,
  updateCheckStatus,
  handleCheckUpdate,
  emailCopied,
  handleCopyContactEmail,
  handleOpenUserManual,
  handleOpenUserCommunity,
  handleExportLogs,
  isExportingLogs,
  aboutContactEmail,
  aboutUserManualUrl,
  aboutUserCommunityUrl,
  aboutServiceTermsUrl,
  error,
  setError,
}) => {
  // Test-mode easter egg: track logo clicks internally so this tab is
  // self-contained. The unlocked flag itself is lifted to the parent.
  const [logoClickCount, setLogoClickCount] = useState(0);

  return (
    <div className="flex min-h-full flex-col items-center pt-6 pb-3">
      {/* Logo & App Name */}
      <img
        src="logo.png"
        alt="Agora"
        className="w-16 h-16 mb-3 cursor-pointer select-none"
        onClick={() => {
          const next = logoClickCount + 1;
          setLogoClickCount(next);
          if (next >= 10 && !testModeUnlocked) {
            setTestModeUnlocked(true);
          }
        }}
      />
      <h3 className="text-lg font-semibold text-foreground">Agora</h3>
      <span className="text-xs text-secondary mt-1">v{appVersion}</span>

      {/* Error banner (shared with the parent Settings) */}
      {error && (
        <div className="w-full mt-4 px-4">
          <ErrorMessage message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Info Card */}
      <div className="w-full mt-8 rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm text-foreground">{i18nService.t('aboutVersion')}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">{appVersion}</span>
            {!enterpriseConfig?.disableUpdate && (
              <button
                type="button"
                disabled={updateCheckStatus === 'checking'}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCheckUpdate();
                }}
                className="text-xs px-2 py-0.5 rounded-md border border-border text-secondary hover:text-primary dark:hover:text-primary hover:border-primary dark:hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateCheckStatus === 'checking' && i18nService.t('updateChecking')}
                {updateCheckStatus === 'upToDate' && i18nService.t('updateUpToDate')}
                {updateCheckStatus === 'error' && i18nService.t('updateCheckFailed')}
                {updateCheckStatus === 'idle' && i18nService.t('checkForUpdate')}
              </button>
            )}
            {enterpriseConfig?.disableUpdate && (
              <span className="text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary">
                {i18nService.t('settings.enterprise.managed')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm text-foreground">{i18nService.t('aboutContactEmail')}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleCopyContactEmail();
              }}
              title={i18nService.t('copyToClipboard')}
              className="text-sm text-secondary bg-transparent border-none appearance-none p-0 m-0 cursor-pointer focus:outline-none"
            >
              {aboutContactEmail}
            </button>
            {emailCopied && (
              <span className="text-[11px] leading-4 text-emerald-600 dark:text-emerald-400">
                {i18nService.t('copied')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm text-foreground">{i18nService.t('aboutUserManual')}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenUserManual();
            }}
            className="text-sm text-secondary hover:text-primary dark:hover:text-primary bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer focus:outline-none hover:bg-surface-raised transition-colors"
          >
            {aboutUserManualUrl}
          </button>
        </div>
        <div className={`flex items-center justify-between px-4 py-3${testModeUnlocked ? ' border-b border-border' : ''}`}>
          <span className="text-sm text-foreground">{i18nService.t('aboutUserCommunity')}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenUserCommunity();
            }}
            className="text-sm text-secondary hover:text-primary dark:hover:text-primary bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer focus:outline-none hover:bg-surface-raised transition-colors"
          >
            {aboutUserCommunityUrl}
          </button>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-foreground">{i18nService.t('exportLogs')}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleExportLogs();
            }}
            disabled={isExportingLogs}
            className="text-xs px-2 py-0.5 rounded-md border border-border text-secondary hover:text-primary dark:hover:text-primary hover:border-primary dark:hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExportingLogs ? i18nService.t('exportingLogs') : i18nService.t('exportLogs')}
          </button>
        </div>
        {testModeUnlocked && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-amber-50/30 dark:bg-amber-900/10">
            <span className="text-sm text-foreground">{i18nService.t('testMode')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={testMode}
              onClick={() => setTestMode((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                testMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  testMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Footer: Service Terms / Export Logs / GitHub link / Copyright */}
      <div className="mt-auto w-full pt-14 pb-2 flex flex-col items-center">
        <div className="flex items-center justify-center text-sm text-secondary">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void window.electron.shell.openExternal(aboutServiceTermsUrl);
            }}
            className="bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer hover:text-primary dark:hover:text-primary transition-colors"
          >
            {i18nService.t('aboutServiceTerms')}
          </button>
          <span className="mx-3 text-xs opacity-40">|</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleExportLogs();
            }}
            disabled={isExportingLogs}
            className="bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer hover:text-primary dark:hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExportingLogs ? i18nService.t('aboutExportingLogs') : i18nService.t('aboutExportLogs')}
          </button>
          <span className="mx-3 text-xs opacity-40">|</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void window.electron.shell.openExternal('https://github.com/freestylefly/agora');
            }}
            className="bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer hover:text-primary dark:hover:text-primary transition-colors"
          >
            开源项目
          </button>
        </div>

        <p className="mt-5 text-xs text-secondary">
          &copy; {new Date().getFullYear()} Agora by 苍何团队 · 数据本地存储 版权所有
        </p>
      </div>
    </div>
  );
};
