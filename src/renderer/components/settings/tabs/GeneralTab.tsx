/**
 * Settings — General Tab
 *
 * Houses global app preferences that aren't tied to a specific
 * conversation engine or IM platform:
 *
 *   1. Language & region (zh / en) — sets i18nService language immediately
 *      so the rest of the dialog re-renders translated.
 *   2. Auto-launch on login — calls `window.electron.autoLaunch.set` and
 *      surfaces errors via the parent's `setError`.
 *   3. Prevent sleep (keep-awake) — calls `window.electron.preventSleep.set`.
 *   4. Use system proxy — local-only toggle (proxy applied on save).
 *   5. Appearance — light/dark/system mode selector with inline SVG
 *      previews, plus the theme gallery (classic + custom themes).
 *
 * All state lives in the parent Settings component so the Save/Cancel
 * footer can persist the snapshot and revert on cancel.
 */

import React from 'react';

import { i18nService, type LanguageType } from '../../../services/i18n';
import { themeService } from '../../../services/theme';
import type { ThemeDefinition } from '../../../theme';
import ThemedSelect from '../../ui/ThemedSelect';

export interface GeneralTabProps {
  // Language
  language: LanguageType;
  setLanguage: React.Dispatch<React.SetStateAction<LanguageType>>;

  // OS integration toggles
  autoLaunch: boolean;
  setAutoLaunchState: React.Dispatch<React.SetStateAction<boolean>>;
  isUpdatingAutoLaunch: boolean;
  setIsUpdatingAutoLaunch: React.Dispatch<React.SetStateAction<boolean>>;

  preventSleep: boolean;
  setPreventSleepState: React.Dispatch<React.SetStateAction<boolean>>;
  isUpdatingPreventSleep: boolean;
  setIsUpdatingPreventSleep: React.Dispatch<React.SetStateAction<boolean>>;

  useSystemProxy: boolean;
  setUseSystemProxy: React.Dispatch<React.SetStateAction<boolean>>;

  // Theme / appearance
  theme: 'light' | 'dark' | 'system';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark' | 'system'>>;
  themeId: string;
  setThemeId: React.Dispatch<React.SetStateAction<string>>;

  // Error display
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  language,
  setLanguage,
  autoLaunch,
  setAutoLaunchState,
  isUpdatingAutoLaunch,
  setIsUpdatingAutoLaunch,
  preventSleep,
  setPreventSleepState,
  isUpdatingPreventSleep,
  setIsUpdatingPreventSleep,
  useSystemProxy,
  setUseSystemProxy,
  theme,
  setTheme,
  themeId,
  setThemeId,
  setError,
}) => {
  return (
    <div className="space-y-8">
      {/* Language */}
      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {i18nService.t('languageRegion')}
            </h4>
            <p className="mt-1 text-xs text-secondary">
              {i18nService.t('appLanguageHint')}
            </p>
          </div>
          <div className="w-[180px] shrink-0">
            <ThemedSelect
              id="language"
              value={language}
              onChange={(value) => {
                const nextLanguage = value as LanguageType;
                setLanguage(nextLanguage);
                i18nService.setLanguage(nextLanguage);
              }}
              options={[
                { value: 'zh', label: i18nService.t('chinese') },
                { value: 'en', label: i18nService.t('english') },
              ]}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {i18nService.t('appLanguage')}
          </span>
          <span className="text-xs text-secondary">
            {language === 'zh' ? i18nService.t('chinese') : i18nService.t('english')}
          </span>
        </div>
      </section>

      {/* Auto-launch Section */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">
          {i18nService.t('autoLaunch')}
        </h4>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-secondary">
            {i18nService.t('autoLaunchDescription')}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={autoLaunch}
            onClick={async () => {
              if (isUpdatingAutoLaunch) return;
              const next = !autoLaunch;
              setIsUpdatingAutoLaunch(true);
              try {
                const result = await window.electron.autoLaunch.set(next);
                if (result.success) {
                  setAutoLaunchState(next);
                } else {
                  setError(result.error || 'Failed to update auto-launch setting');
                }
              } catch (err) {
                console.error('Failed to set auto-launch:', err);
                setError('Failed to update auto-launch setting');
              } finally {
                setIsUpdatingAutoLaunch(false);
              }
            }}
            disabled={isUpdatingAutoLaunch}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              isUpdatingAutoLaunch ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              autoLaunch ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoLaunch ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Prevent Sleep Section */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">
          {i18nService.t('preventSleep')}
        </h4>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-secondary">
            {i18nService.t('preventSleepDescription')}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={preventSleep}
            onClick={async () => {
              if (isUpdatingPreventSleep) return;
              const next = !preventSleep;
              setIsUpdatingPreventSleep(true);
              try {
                const result = await window.electron.preventSleep.set(next);
                if (result.success) {
                  setPreventSleepState(next);
                } else {
                  setError(result.error || 'Failed to update prevent-sleep setting');
                }
              } catch (err) {
                console.error('Failed to set prevent-sleep:', err);
                setError('Failed to update prevent-sleep setting');
              } finally {
                setIsUpdatingPreventSleep(false);
              }
            }}
            disabled={isUpdatingPreventSleep}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              isUpdatingPreventSleep ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              preventSleep ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preventSleep ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {/* System proxy Section */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">
          {i18nService.t('useSystemProxy')}
        </h4>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-secondary">
            {i18nService.t('useSystemProxyDescription')}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={useSystemProxy}
            onClick={() => {
              setUseSystemProxy((prev) => !prev);
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              useSystemProxy ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                useSystemProxy ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Appearance Section — mode selector + theme gallery */}
      <div>
        <h4
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--lobster-text-primary)' }}
        >
          {i18nService.t('appearance')}
        </h4>

        {/* Level 1: Mode selector */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {(['light', 'dark', 'system'] as const).map((mode) => {
            const isSelected = theme === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setTheme(mode);
                  themeService.setTheme(mode);
                  setThemeId(themeService.getThemeId());
                }}
                className="flex flex-col items-center rounded-xl border-2 p-3 transition-colors cursor-pointer"
                style={{
                  borderColor: isSelected
                    ? 'var(--lobster-primary)'
                    : 'var(--lobster-border)',
                  backgroundColor: isSelected
                    ? 'var(--lobster-primary-muted)'
                    : undefined,
                }}
              >
                <svg
                  viewBox="0 0 120 80"
                  className="w-full h-auto rounded-md mb-2 overflow-hidden"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {mode === 'light' && (
                    <>
                      <rect width="120" height="80" fill="#F8F9FB" />
                      <rect x="0" y="0" width="30" height="80" fill="#EBEDF0" />
                      <rect x="4" y="8" width="22" height="4" rx="2" fill="#C8CBD0" />
                      <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#D5D7DB" />
                      <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#D5D7DB" />
                      <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#D5D7DB" />
                      <rect x="36" y="8" width="78" height="64" rx="4" fill="#FFFFFF" />
                      <rect x="42" y="16" width="50" height="4" rx="2" fill="#D5D7DB" />
                      <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                      <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#E2E4E7" />
                      <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#E2E4E7" />
                      <rect x="42" y="46" width="40" height="4" rx="2" fill="#D5D7DB" />
                      <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                      <rect x="42" y="60" width="58" height="3" rx="1.5" fill="#E2E4E7" />
                    </>
                  )}
                  {mode === 'dark' && (
                    <>
                      <rect width="120" height="80" fill="#0F1117" />
                      <rect x="0" y="0" width="30" height="80" fill="#151820" />
                      <rect x="4" y="8" width="22" height="4" rx="2" fill="#3A3F4B" />
                      <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#2A2F3A" />
                      <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#2A2F3A" />
                      <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#2A2F3A" />
                      <rect x="36" y="8" width="78" height="64" rx="4" fill="#1A1D27" />
                      <rect x="42" y="16" width="50" height="4" rx="2" fill="#3A3F4B" />
                      <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#252930" />
                      <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#252930" />
                    </>
                  )}
                  {mode === 'system' && (
                    <>
                      <rect width="60" height="80" fill="#F8F9FB" />
                      <rect x="60" width="60" height="80" fill="#0F1117" />
                      <rect x="60" y="0" width="0" height="80" stroke="#3A3F4B" strokeWidth="1" />
                      <rect x="4" y="8" width="22" height="4" rx="2" fill="#C8CBD0" />
                      <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#D5D7DB" />
                      <rect x="36" y="8" width="20" height="4" rx="2" fill="#3A3F4B" />
                      <rect x="36" y="16" width="16" height="3" rx="1.5" fill="#252930" />
                    </>
                  )}
                </svg>
                <span className="text-xs font-medium text-foreground">
                  {i18nService.t(`theme${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Level 2: Theme gallery */}
        {(() => {
          const allThemes = themeService.getAllThemes();
          const classicThemes = allThemes.filter(
            (t) => t.meta.id === 'classic-light' || t.meta.id === 'classic-dark',
          );
          const otherThemes = allThemes.filter(
            (t) => t.meta.id !== 'classic-light' && t.meta.id !== 'classic-dark',
          );
          const renderTile = (t: ThemeDefinition) => {
            const isSelected = themeId === t.meta.id;
            const [bg, c1, c2, c3] = t.meta.preview;
            return (
              <button
                key={t.meta.id}
                type="button"
                onClick={() => {
                  themeService.setThemeById(t.meta.id);
                  setThemeId(t.meta.id);
                  setTheme(t.meta.appearance as 'light' | 'dark');
                }}
                className="flex flex-col items-center rounded-xl border-2 p-2 transition-colors cursor-pointer"
                style={{
                  borderColor: isSelected
                    ? 'var(--lobster-primary)'
                    : 'var(--lobster-border)',
                  backgroundColor: isSelected
                    ? 'var(--lobster-primary-muted)'
                    : undefined,
                }}
              >
                <svg
                  viewBox="0 0 80 48"
                  className="w-full h-auto rounded-md mb-1.5 overflow-hidden"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="80" height="48" fill={bg} />
                  <rect x="4" y="6" width="20" height="36" rx="3" fill={c1} opacity="0.7" />
                  <rect x="28" y="6" width="48" height="36" rx="3" fill={c2} opacity="0.5" />
                  <circle cx="52" cy="24" r="8" fill={c3} opacity="0.8" />
                  <rect x="32" y="34" width="40" height="4" rx="2" fill={c1} opacity="0.6" />
                </svg>
                <span
                  className="text-[10px] font-medium truncate w-full text-center"
                  style={{
                    color: isSelected
                      ? 'var(--lobster-primary)'
                      : 'var(--lobster-text-primary)',
                  }}
                >
                  {t.meta.name}
                </span>
              </button>
            );
          };
          return (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {classicThemes.map(renderTile)}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {otherThemes.map(renderTile)}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};
