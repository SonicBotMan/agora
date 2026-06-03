/**
 * Agora Settings — Shared State Hook
 *
 * Centralizes the useState/useRef declarations that were previously inline
 * at the top of the Settings component. These cover state and refs shared
 * across multiple tabs (theme, language, active tab, etc.) plus general UI
 * flags (test mode, error message, saving state, etc.).
 *
 * Tab-specific state (providers, cowork memory, agent engines, ...) stays
 * inline in Settings.tsx for now and will be split into dedicated hooks
 * in later batches.
 */

import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { i18nService, type LanguageType } from '../../../services/i18n';
import { themeService } from '../../../services/theme';
import type { TabType } from '../types';

// ProviderConnectionTestResult and ProviderType are declared inside
// Settings.tsx (not exported). To keep this hook self-contained we mirror
// the relevant shapes here. If they later become shared types, replace
// these with imports.
export interface ProviderConnectionTestResult {
  ok?: boolean;
  success?: boolean;
  message: string;
  provider?: string;
  result?: { latencyMs?: number; modelId?: string };
}
export type ProviderType = string; // mirror of `type ProviderType = (typeof providerKeys)[number]`

export interface UseSettingsSharedStateParams {
  initialTab?: TabType;
  notice?: string;
  noticeI18nKey?: string;
  noticeExtra?: string;
}

export type SetState<T> = Dispatch<SetStateAction<T>>;

export interface UseSettingsSharedStateResult {
  // Active tab navigation
  activeTab: TabType;
  setActiveTab: SetState<TabType>;

  // Appearance (theme + language)
  theme: 'light' | 'dark' | 'system';
  setTheme: SetState<'light' | 'dark' | 'system'>;
  themeId: string;
  setThemeId: SetState<string>;
  language: LanguageType;
  setLanguage: SetState<LanguageType>;

  // OS integration toggles
  autoLaunch: boolean;
  setAutoLaunchState: SetState<boolean>;
  useSystemProxy: boolean;
  setUseSystemProxy: SetState<boolean>;
  isUpdatingAutoLaunch: boolean;
  setIsUpdatingAutoLaunch: SetState<boolean>;
  preventSleep: boolean;
  setPreventSleepState: SetState<boolean>;
  isUpdatingPreventSleep: boolean;
  setIsUpdatingPreventSleep: SetState<boolean>;

  // Save state
  isSaving: boolean;
  setIsSaving: SetState<boolean>;
  error: string | null;
  setError: SetState<string | null>;
  noticeMessage: string | null;
  setNoticeMessage: SetState<string | null>;

  // Provider connection test modal
  testResult: ProviderConnectionTestResult | null;
  setTestResult: SetState<ProviderConnectionTestResult | null>;
  isTestResultModalOpen: boolean;
  setIsTestResultModalOpen: SetState<boolean>;
  isTesting: boolean;
  setIsTesting: SetState<boolean>;
  pendingDeleteProvider: ProviderType | null;
  setPendingDeleteProvider: SetState<ProviderType | null>;
  isImportingProviders: boolean;
  setIsImportingProviders: SetState<boolean>;
  isExportingProviders: boolean;
  setIsExportingProviders: SetState<boolean>;

  // Test mode easter egg
  testMode: boolean;
  setTestMode: SetState<boolean>;
  testModeUnlocked: boolean;
  setTestModeUnlocked: SetState<boolean>;

  // Refs
  initialThemeRef: MutableRefObject<'light' | 'dark' | 'system'>;
  initialThemeIdRef: MutableRefObject<string>;
  initialLanguageRef: MutableRefObject<LanguageType>;
  didSaveRef: MutableRefObject<boolean>;
}

export function useSettingsSharedState(
  params: UseSettingsSharedStateParams = {},
): UseSettingsSharedStateResult {
  const { initialTab, notice, noticeI18nKey, noticeExtra } = params;

  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? 'general');

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [themeId, setThemeId] = useState<string>(themeService.getThemeId());
  const [language, setLanguage] = useState<LanguageType>('zh');

  const [autoLaunch, setAutoLaunchState] = useState(false);
  const [useSystemProxy, setUseSystemProxy] = useState(false);
  const [isUpdatingAutoLaunch, setIsUpdatingAutoLaunch] = useState(false);
  const [preventSleep, setPreventSleepState] = useState(false);
  const [isUpdatingPreventSleep, setIsUpdatingPreventSleep] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notice message is computed lazily once at mount; the prop-derived
  // snapshot intentionally freezes the initial value so subsequent prop
  // changes (e.g. when Settings is re-mounted) don't silently rewrite the
  // message. The original implementation did the same via useState lazy init.
  const [noticeMessage, setNoticeMessage] = useState<string | null>(() => {
    if (noticeI18nKey) {
      const base = i18nService.t(noticeI18nKey);
      return noticeExtra ? `${base} (${noticeExtra})` : base;
    }
    return notice ?? null;
  });

  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);
  const [isTestResultModalOpen, setIsTestResultModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [pendingDeleteProvider, setPendingDeleteProvider] = useState<ProviderType | null>(null);
  const [isImportingProviders, setIsImportingProviders] = useState(false);
  const [isExportingProviders, setIsExportingProviders] = useState(false);

  const [testMode, setTestMode] = useState(false);
  const [testModeUnlocked, setTestModeUnlocked] = useState(false);

  const initialThemeRef = useRef<'light' | 'dark' | 'system'>(themeService.getTheme());
  const initialThemeIdRef = useRef<string>(themeService.getThemeId());
  const initialLanguageRef = useRef<LanguageType>(i18nService.getLanguage());
  const didSaveRef = useRef(false);

  return {
    activeTab, setActiveTab,
    theme, setTheme,
    themeId, setThemeId,
    language, setLanguage,
    autoLaunch, setAutoLaunchState,
    useSystemProxy, setUseSystemProxy,
    isUpdatingAutoLaunch, setIsUpdatingAutoLaunch,
    preventSleep, setPreventSleepState,
    isUpdatingPreventSleep, setIsUpdatingPreventSleep,
    isSaving, setIsSaving,
    error, setError,
    noticeMessage, setNoticeMessage,
    testResult, setTestResult,
    isTestResultModalOpen, setIsTestResultModalOpen,
    isTesting, setIsTesting,
    pendingDeleteProvider, setPendingDeleteProvider,
    isImportingProviders, setIsImportingProviders,
    isExportingProviders, setIsExportingProviders,
    testMode, setTestMode,
    testModeUnlocked, setTestModeUnlocked,
    initialThemeRef,
    initialThemeIdRef,
    initialLanguageRef,
    didSaveRef,
  };
}
