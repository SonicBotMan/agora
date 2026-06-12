import { ChatBubbleLeftIcon, ClockIcon, Cog6ToothIcon, CpuChipIcon, CubeIcon, EnvelopeIcon, InformationCircleIcon, UserCircleIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  ClaudeCodePermissionMode as ClaudeCodePermissionModeValue,
  CoworkAgentEngine as CoworkAgentEngineValue,
  DeepSeekTuiPermissionMode as DeepSeekTuiPermissionModeValue,
  ExternalAgentConfigSource as ExternalAgentConfigSourceValue,
  OpenCodePermissionMode as OpenCodePermissionModeValue,
} from '@shared/cowork/constants';
import React, { useCallback,useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { ProviderRegistry } from '../../shared/providers';
import { type AppConfig, defaultConfig, getCustomProviderDefaultName,getProviderDisplayName,getVisibleProviders } from '../config';
 // (export-format helpers removed with the provider import/export block)
import { apiService } from '../services/api';
import type { AppUpdateInfo } from '../services/appUpdate';
import { checkForAppUpdate } from '../services/appUpdate';
import { configService } from '../services/config';
import { coworkService } from '../services/cowork';
 // (encryption helpers removed with the provider import/export block)
import { i18nService } from '../services/i18n';
import { imService } from '../services/im';
import { themeService } from '../services/theme';
import { RootState } from '../store';
import { setAvailableModels } from '../store/slices/modelSlice';
import type {
  ClaudeCodePermissionMode,
  CoworkAgentEngine,
  CoworkMemoryStats,
  CoworkUserMemoryEntry,
  DeepSeekTuiPermissionMode,
  ExternalAgentCliInstallProgress,
  ExternalAgentConfigSource,
  ExternalAgentEnvironmentSnapshot,
  ExternalAgentProvider,
  ExternalAgentProviderAppType,
  ExternalAgentProviderListResult,
  HermesEngineStatus,
  OpenClawEngineStatus,
  OpenCodePermissionMode,
} from '../types/cowork';
import AgentsView from './agent/AgentsView';
import Modal from './common/Modal';
import ErrorMessage from './ErrorMessage';
import BrainIcon from './icons/BrainIcon';
import ConnectorIcon from './icons/ConnectorIcon';
import {
  AnthropicIcon,
  CustomProviderIcon,
  DeepSeekIcon,
  GeminiIcon,
  GitHubCopilotIcon,
  MiniMaxIcon,
  MoonshotIcon,
  OllamaIcon,
  OpenAIIcon,
  OpenRouterIcon,
  QwenIcon,
  StepfunIcon,
  VolcengineIcon,
  XiaomiIcon,
  YouDaoZhiYunIcon,
  ZhipuIcon,
} from './icons/providers';
import IMSettings from './im/IMSettings';
import McpManager from './mcp/McpManager';
import { ScheduledTasksView } from './scheduledTasks';
import { useModelEditor } from './settings/hooks/useModelEditor';
import { useSettingsSharedState } from './settings/hooks/useSettingsSharedState';
import { DeleteProviderModal } from './settings/modals/DeleteProviderModal';
import { ModelEditorModal } from './settings/modals/ModelEditorModal';
import {
  CUSTOM_PROVIDER_KEYS,
  getDefaultActiveProvider,
  getDefaultProviders,
  getEffectiveApiFormat,
  getProviderDefaultBaseUrl,
  ProviderConfig,
  providerKeys,
  providerRequiresApiKey,
  type ProvidersConfig,
  type ProviderType,
  resolveBaseUrl,
  shouldAutoSwitchProviderBaseUrl,
} from './settings/providerConfigUtils';
import { AboutTab } from './settings/tabs/AboutTab';
import { CoworkAgentEngineTab } from './settings/tabs/CoworkAgentEngineTab';
import { CoworkAgentTab } from './settings/tabs/CoworkAgentTab';
import { CoworkMemoryTab } from './settings/tabs/CoworkMemoryTab';
import { GeneralTab } from './settings/tabs/GeneralTab';
import { ModelTab } from './settings/tabs/ModelTab';
import { ShortcutsTab } from './settings/tabs/ShortcutsTab';
import type { TabType } from './settings/types';
import EmailSkillConfig from './skills/EmailSkillConfig';

export type SettingsOpenOptions = {
  initialTab?: TabType;
  notice?: string;
  noticeI18nKey?: string;
  noticeExtra?: string;
};

interface SettingsProps extends SettingsOpenOptions {
  onClose: () => void;
  onUpdateFound?: (info: AppUpdateInfo) => void;
  enterpriseConfig?: {
    ui?: Record<string, 'hide' | 'disable' | 'readonly'>;
    disableUpdate?: boolean;
  } | null;
}



const providerMeta: Record<ProviderType, { label: string; icon: React.ReactNode }> = {
  openai: { label: 'OpenAI', icon: <OpenAIIcon /> },
  deepseek: { label: 'DeepSeek', icon: <DeepSeekIcon /> },
  gemini: { label: 'Google', icon: <GeminiIcon /> },
  anthropic: { label: 'Claude', icon: <AnthropicIcon /> },
  moonshot: { label: 'Moonshot', icon: <MoonshotIcon /> },
  zhipu: { label: 'Zhipu', icon: <ZhipuIcon /> },
  minimax: { label: 'MiniMax', icon: <MiniMaxIcon /> },
  youdaozhiyun: { label: 'Youdao', icon: <YouDaoZhiYunIcon /> },
  qwen: { label: 'Qwen', icon: <QwenIcon /> },
  xiaomi: { label: 'Xiaomi', icon: <XiaomiIcon /> },
  stepfun: { label: 'StepFun', icon: <StepfunIcon /> },
  volcengine: { label: 'Volcengine', icon: <VolcengineIcon /> },
  openrouter: { label: 'OpenRouter', icon: <OpenRouterIcon /> },
  'github-copilot': { label: 'GitHub Copilot', icon: <GitHubCopilotIcon /> },
  ollama: { label: 'Ollama', icon: <OllamaIcon /> },
  ...Object.fromEntries(
    CUSTOM_PROVIDER_KEYS.map(key => [key, { label: getCustomProviderDefaultName(key), icon: <CustomProviderIcon /> }])
  ) as Record<(typeof CUSTOM_PROVIDER_KEYS)[number], { label: string; icon: React.ReactNode }>,
};

const providerLinks: Partial<Record<ProviderType, { website: string; apiKey?: string }>> = {
  openai:       { website: 'https://platform.openai.com',              apiKey: 'https://platform.openai.com/api-keys' },
  gemini:       { website: 'https://aistudio.google.com',              apiKey: 'https://aistudio.google.com/apikey' },
  anthropic:    { website: 'https://console.anthropic.com',            apiKey: 'https://console.anthropic.com/settings/keys' },
  deepseek:     { website: 'https://platform.deepseek.com',            apiKey: 'https://platform.deepseek.com/api_keys' },
  moonshot:     { website: 'https://platform.moonshot.cn',             apiKey: 'https://platform.moonshot.cn/console/api-keys' },
  zhipu:        { website: 'https://open.bigmodel.cn',                 apiKey: 'https://open.bigmodel.cn/usercenter/apikeys' },
  minimax:      { website: 'https://platform.minimaxi.com',            apiKey: 'https://platform.minimaxi.com/user-center/basic-information/interface-key' },
  volcengine:   { website: 'https://console.volcengine.com/ark',       apiKey: 'https://console.volcengine.com/ark' },
  qwen:         { website: 'https://dashscope.console.aliyun.com',     apiKey: 'https://dashscope.console.aliyun.com/apiKey' },
  youdaozhiyun: { website: 'https://ai.youdao.com',                    apiKey: 'https://ai.youdao.com/console' },
  stepfun:      { website: 'https://platform.stepfun.com',             apiKey: 'https://platform.stepfun.com/interface-key' },
  xiaomi:       { website: 'https://dev.mi.com/platform',              apiKey: 'https://dev.mi.com/platform' },
  openrouter:   { website: 'https://openrouter.ai',                    apiKey: 'https://openrouter.ai/keys' },
  ollama:       { website: 'https://ollama.com' },
};

const ABOUT_CONTACT_EMAIL = 'hello@agora.ai';
const ABOUT_USER_MANUAL_URL = 'https://agora.ai/docs';
const ABOUT_USER_COMMUNITY_URL = '敬请期待';
const ABOUT_SERVICE_TERMS_URL = 'https://agora.ai/terms';

// MiniMax Portal OAuth constants
const MINIMAX_OAUTH_CLIENT_ID = '78257093-7e40-4613-99e0-527b14b39113';
const MINIMAX_OAUTH_SCOPE = 'group_id profile model.completion';
const MINIMAX_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:user_code';
const MINIMAX_BASE_URL_CN = 'https://api.minimaxi.com/anthropic';
const MINIMAX_BASE_URL_GLOBAL = 'https://api.minimax.io/anthropic';
const MINIMAX_CODE_ENDPOINT_CN = 'https://api.minimaxi.com/oauth/code';
const MINIMAX_CODE_ENDPOINT_GLOBAL = 'https://api.minimax.io/oauth/code';
const MINIMAX_TOKEN_ENDPOINT_CN = 'https://api.minimaxi.com/oauth/token';
const MINIMAX_TOKEN_ENDPOINT_GLOBAL = 'https://api.minimax.io/oauth/token';

type MiniMaxRegion = 'cn' | 'global';
type MiniMaxOAuthPhase =
  | { kind: 'idle' }
  | { kind: 'requesting_code' }
  | { kind: 'pending'; userCode: string; verificationUri: string }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

async function generateMiniMaxPkce(): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifierArray = new Uint8Array(32);
  crypto.getRandomValues(verifierArray);
  const verifier = btoa(String.fromCharCode(...verifierArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const stateArray = new Uint8Array(16);
  crypto.getRandomValues(stateArray);
  const state = btoa(String.fromCharCode(...stateArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge, state };
}

const copyTextFallback = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (clipboardError) {
      console.warn('Navigator clipboard write failed, trying fallback:', clipboardError);
    }
  }

  try {
    return copyTextFallback(text);
  } catch (fallbackError) {
    console.error('Fallback clipboard copy failed:', fallbackError);
    return false;
  }
};


// System shortcuts that should not be captured (clipboard, undo, select-all, quit, etc.)

const Settings: React.FC<SettingsProps> = ({ onClose, initialTab, notice, noticeI18nKey, noticeExtra, onUpdateFound, enterpriseConfig }) => {
  const dispatch = useDispatch();
  // Shared state (theme, language, active tab, save state, provider-test state,
  // test-mode easter egg, and the initial-* refs). Tab-specific state lives
  // inline further below.
  const {
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
    pendingDeleteProvider, setPendingDeleteProvider,
    testMode, setTestMode,
    testModeUnlocked, setTestModeUnlocked,
    initialThemeRef,
    initialThemeIdRef,
    initialLanguageRef,
    didSaveRef,
  } = useSettingsSharedState({ initialTab, notice, noticeI18nKey, noticeExtra });

  // Add state for active provider
  const [activeProvider, setActiveProvider] = useState<ProviderType>(getDefaultActiveProvider());
  const [showApiKey, setShowApiKey] = useState(false);

  // MiniMax OAuth state
  const [minimaxOAuthPhase, setMinimaxOAuthPhase] = useState<MiniMaxOAuthPhase>({ kind: 'idle' });
  // minimaxOAuthRegion is read-only state — the region selector was
  // removed in a previous refactor but the read is still needed by
  // handleMiniMaxDeviceLogin. We declare it without a setter.
  // (If a region selector is reintroduced, restore the setter.)
   
  const minimaxOAuthRegion: MiniMaxRegion = 'cn';
  const minimaxOAuthCancelRef = useRef(false);

  // Add state for providers configuration
  const [providers, setProviders] = useState<ProvidersConfig>(() => getDefaultProviders());


  // authType defaults to undefined on first open, which should behave as OAuth mode
  const minimaxIsOAuthMode = providers.minimax.authType !== 'apikey';
  const isBaseUrlLocked = (activeProvider === 'zhipu' && providers.zhipu.codingPlanEnabled) || (activeProvider === 'qwen' && providers.qwen.codingPlanEnabled) || (activeProvider === 'volcengine' && providers.volcengine.codingPlanEnabled) || (activeProvider === 'moonshot' && providers.moonshot.codingPlanEnabled) || (activeProvider === 'minimax' && minimaxIsOAuthMode);
  
  // 创建引用来确保内容区域的滚动
  const contentRef = useRef<HTMLDivElement>(null);
  const emailCopiedTimerRef = useRef<number | null>(null);
  const updateCheckTimerRef = useRef<number | null>(null);
  
  // 快捷键设置
  const [shortcuts, setShortcuts] = useState({
    newChat: 'Ctrl+N',
    search: 'Ctrl+F',
    settings: 'Ctrl+,',
  });

  // GitHub Copilot device code auth state
  const [copilotAuthStatus, setCopilotAuthStatus] = useState<'idle' | 'requesting' | 'awaiting_user' | 'polling' | 'authenticated' | 'error'>('idle');
  const [copilotUserCode, setCopilotUserCode] = useState('');
  const [copilotVerificationUri, setCopilotVerificationUri] = useState('');
  const [copilotGithubUser, setCopilotGithubUser] = useState('');
  const [copilotError, setCopilotError] = useState<string | null>(null);

  // State for model editing
  const modelEditor = useModelEditor({
    providers,
    setProviders,
    activeProvider,
  });

  // About tab
  const [appVersion, setAppVersion] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);
  const [isExportingLogs, setIsExportingLogs] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'upToDate' | 'error'>('idle');

  useEffect(() => {
    window.electron.appInfo.getVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    setShowApiKey(false);
  }, [activeProvider]);

  const handleCopyContactEmail = useCallback(async () => {
    const copied = await copyTextToClipboard(ABOUT_CONTACT_EMAIL);
    if (copied) {
      setEmailCopied(true);
      if (emailCopiedTimerRef.current != null) {
        window.clearTimeout(emailCopiedTimerRef.current);
      }
      emailCopiedTimerRef.current = window.setTimeout(() => {
        setEmailCopied(false);
        emailCopiedTimerRef.current = null;
      }, 1200);
    }
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    if (updateCheckStatus === 'checking' || !appVersion) return;
    setUpdateCheckStatus('checking');
    try {
      const info = await checkForAppUpdate(appVersion, true);
      if (info) {
        setUpdateCheckStatus('idle');
        onUpdateFound?.(info);
      } else {
        setUpdateCheckStatus('upToDate');
        if (updateCheckTimerRef.current != null) {
          window.clearTimeout(updateCheckTimerRef.current);
        }
        updateCheckTimerRef.current = window.setTimeout(() => {
          setUpdateCheckStatus('idle');
          updateCheckTimerRef.current = null;
        }, 3000);
      }
    } catch {
      setUpdateCheckStatus('error');
      if (updateCheckTimerRef.current != null) {
        window.clearTimeout(updateCheckTimerRef.current);
      }
      updateCheckTimerRef.current = window.setTimeout(() => {
        setUpdateCheckStatus('idle');
        updateCheckTimerRef.current = null;
      }, 3000);
    }
  }, [appVersion, updateCheckStatus, onUpdateFound]);

  const handleOpenUserManual = useCallback(() => {
    void window.electron.shell.openExternal(ABOUT_USER_MANUAL_URL);
  }, []);

  const handleOpenUserCommunity = useCallback(() => {
    if (ABOUT_USER_COMMUNITY_URL.startsWith('http')) {
      void window.electron.shell.openExternal(ABOUT_USER_COMMUNITY_URL);
    }
  }, []);

  // Removed the unused handleOpenServiceTerms callback — the About tab now
  // inlines this as `window.electron.shell.openExternal(aboutServiceTermsUrl)`.

  const handleExportLogs = useCallback(async () => {
    if (isExportingLogs) {
      return;
    }

    setError(null);
    setNoticeMessage(null);
    setIsExportingLogs(true);
    try {
      const result = await window.electron.log.exportZip();
      if (!result.success) {
        setError(result.error || i18nService.t('aboutExportLogsFailed'));
        return;
      }
      if (result.canceled) {
        return;
      }

      if (result.path) {
        await window.electron.shell.showItemInFolder(result.path);
      }

      if ((result.missingEntries?.length ?? 0) > 0) {
        const missingList = result.missingEntries?.join(', ') || '';
        setNoticeMessage(`${i18nService.t('aboutExportLogsPartial')}: ${missingList}`);
      } else {
        setNoticeMessage(i18nService.t('aboutExportLogsSuccess'));
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : i18nService.t('aboutExportLogsFailed'));
    } finally {
      setIsExportingLogs(false);
    }
  }, [isExportingLogs]);

  const coworkConfig = useSelector((state: RootState) => state.cowork.config);

  const [coworkAgentEngine, setCoworkAgentEngine] = useState<CoworkAgentEngine>(coworkConfig.agentEngine || CoworkAgentEngineValue.OpenCode);
  const [expandedCoworkAgentEngine, setExpandedCoworkAgentEngine] = useState<CoworkAgentEngine | null>(null);

  const handleSelectCoworkAgentEngine = (engine: CoworkAgentEngine) => {
    if (isSaving) return;
    setCoworkAgentEngine(engine);
    setExpandedCoworkAgentEngine(engine);
  };

  const handleToggleCoworkAgentEngineDetails = (engine: CoworkAgentEngine) => {
    if (isSaving) return;
    setExpandedCoworkAgentEngine((current) => (
      current === engine ? null : engine
    ));
  };
  const [coworkMemoryEnabled, setCoworkMemoryEnabled] = useState<boolean>(coworkConfig.memoryEnabled ?? true);
  const [coworkMemoryLlmJudgeEnabled, setCoworkMemoryLlmJudgeEnabled] = useState<boolean>(coworkConfig.memoryLlmJudgeEnabled ?? false);
  const [coworkMemoryEntries, setCoworkMemoryEntries] = useState<CoworkUserMemoryEntry[]>([]);
  const [coworkMemoryStats, setCoworkMemoryStats] = useState<CoworkMemoryStats | null>(null);
  const [coworkMemoryListLoading, setCoworkMemoryListLoading] = useState<boolean>(false);
  const [coworkMemoryQuery, setCoworkMemoryQuery] = useState<string>('');
  const [coworkMemoryEditingId, setCoworkMemoryEditingId] = useState<string | null>(null);
  const [coworkMemoryDraftText, setCoworkMemoryDraftText] = useState<string>('');
  const [showMemoryModal, setShowMemoryModal] = useState<boolean>(false);
  const [bootstrapIdentity, setBootstrapIdentity] = useState<string>('');
  const [bootstrapUser, setBootstrapUser] = useState<string>('');
  const [bootstrapSoul, setBootstrapSoul] = useState<string>('');
  const [bootstrapLoaded, setBootstrapLoaded] = useState<boolean>(false);
  const [openClawEngineStatus, setOpenClawEngineStatus] = useState<OpenClawEngineStatus | null>(null);
  const [hermesEngineStatus, setHermesEngineStatus] = useState<HermesEngineStatus | null>(null);
  const [agentEnvironmentSnapshot, setAgentEnvironmentSnapshot] = useState<ExternalAgentEnvironmentSnapshot | null>(null);
  const [openclawConfigSource, setOpenClawConfigSource] = useState<ExternalAgentConfigSource>(
    coworkConfig.openclawConfigSource ?? ExternalAgentConfigSourceValue.LocalCli,
  );
  const [claudeCodeConfigSource, setClaudeCodeConfigSource] = useState<ExternalAgentConfigSource>(
    coworkConfig.claudeCodeConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel,
  );
  const [claudeCodePermissionMode, setClaudeCodePermissionMode] = useState<ClaudeCodePermissionMode>(
    coworkConfig.claudeCodePermissionMode ?? ClaudeCodePermissionModeValue.BypassPermissions,
  );
  const [codexConfigSource, setCodexConfigSource] = useState<ExternalAgentConfigSource>(
    coworkConfig.codexConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel,
  );
  const [hermesConfigSource, setHermesConfigSource] = useState<ExternalAgentConfigSource>(
    coworkConfig.hermesConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel,
  );
  const [opencodeConfigSource, setOpenCodeConfigSource] = useState<ExternalAgentConfigSource>(
    coworkConfig.opencodeConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel,
  );
  const [opencodePermissionMode, setOpenCodePermissionMode] = useState<OpenCodePermissionMode>(
    coworkConfig.opencodePermissionMode ?? OpenCodePermissionModeValue.Auto,
  );
  const [deepseekTuiConfigSource, setDeepSeekTuiConfigSource] = useState<ExternalAgentConfigSource>(
    coworkConfig.deepseekTuiConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel,
  );
  const [deepseekTuiPermissionMode, setDeepSeekTuiPermissionMode] = useState<DeepSeekTuiPermissionMode>(
    coworkConfig.deepseekTuiPermissionMode ?? DeepSeekTuiPermissionModeValue.Auto,
  );
  const [agentConfigImportingAppType, setAgentConfigImportingAppType] = useState<ExternalAgentProviderAppType | null>(null);
  const [openclawGlobalSyncing, setOpenClawGlobalSyncing] = useState(false);
  const [opencodeGlobalSyncing, setOpenCodeGlobalSyncing] = useState(false);
  const [deepseekTuiGlobalSyncing, setDeepSeekTuiGlobalSyncing] = useState(false);
  const [agentCliInstallingAppType, setAgentCliInstallingAppType] = useState<ExternalAgentProviderAppType | null>(null);
  const [agentCliInstallProgress, setAgentCliInstallProgress] = useState<Record<ExternalAgentProviderAppType, string>>({
    claude: '',
    codex: '',
    hermes: '',
    openclaw: '',
    opencode: '',
    deepseek_tui: '',
  });
  const [agentProviderLists, setAgentProviderLists] = useState<Partial<Record<ExternalAgentProviderAppType, ExternalAgentProviderListResult>>>({});
  const [agentProviderLoadingAppType, setAgentProviderLoadingAppType] = useState<ExternalAgentProviderAppType | null>(null);
  const [agentProviderSwitchingId, setAgentProviderSwitchingId] = useState<string | null>(null);

  const selectedExternalAgentAppType = useMemo<ExternalAgentProviderAppType | null>(() => {
    if (coworkAgentEngine === CoworkAgentEngineValue.ClaudeCode) return 'claude';
    if (coworkAgentEngine === CoworkAgentEngineValue.Codex) return 'codex';
    if (coworkAgentEngine === CoworkAgentEngineValue.Hermes) return 'hermes';
    if (coworkAgentEngine === CoworkAgentEngineValue.OpenCode) return 'opencode';
    if (coworkAgentEngine === CoworkAgentEngineValue.DeepSeekTui) return 'deepseek_tui';
    return null;
  }, [coworkAgentEngine]);

  useEffect(() => {
    setCoworkAgentEngine(coworkConfig.agentEngine || CoworkAgentEngineValue.OpenCode);
    setOpenClawConfigSource(coworkConfig.openclawConfigSource ?? ExternalAgentConfigSourceValue.LocalCli);
    setClaudeCodeConfigSource(coworkConfig.claudeCodeConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel);
    setClaudeCodePermissionMode(coworkConfig.claudeCodePermissionMode ?? ClaudeCodePermissionModeValue.BypassPermissions);
    setCodexConfigSource(coworkConfig.codexConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel);
    setHermesConfigSource(coworkConfig.hermesConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel);
    setOpenCodeConfigSource(coworkConfig.opencodeConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel);
    setOpenCodePermissionMode(coworkConfig.opencodePermissionMode ?? OpenCodePermissionModeValue.Auto);
    setDeepSeekTuiConfigSource(coworkConfig.deepseekTuiConfigSource ?? ExternalAgentConfigSourceValue.AgoraModel);
    setDeepSeekTuiPermissionMode(coworkConfig.deepseekTuiPermissionMode ?? DeepSeekTuiPermissionModeValue.Auto);
    setCoworkMemoryEnabled(coworkConfig.memoryEnabled ?? true);
    setCoworkMemoryLlmJudgeEnabled(coworkConfig.memoryLlmJudgeEnabled ?? false);
  }, [
    coworkConfig.agentEngine,
    coworkConfig.openclawConfigSource,
    coworkConfig.claudeCodeConfigSource,
    coworkConfig.claudeCodePermissionMode,
    coworkConfig.codexConfigSource,
    coworkConfig.hermesConfigSource,
    coworkConfig.opencodeConfigSource,
    coworkConfig.opencodePermissionMode,
    coworkConfig.deepseekTuiConfigSource,
    coworkConfig.deepseekTuiPermissionMode,
    coworkConfig.memoryEnabled,
    coworkConfig.memoryLlmJudgeEnabled,
  ]);

  useEffect(() => () => {
    if (emailCopiedTimerRef.current != null) {
      window.clearTimeout(emailCopiedTimerRef.current);
    }
    if (updateCheckTimerRef.current != null) {
      window.clearTimeout(updateCheckTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void coworkService.getAgentEngineSnapshot().then((snapshot) => {
      if (!active) return;
      setAgentEnvironmentSnapshot(snapshot);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = coworkService.onAgentCliInstallProgress((progress: ExternalAgentCliInstallProgress) => {
      const message = progress.detail
        ? `${progress.message} ${progress.detail}`
        : progress.message;
      setAgentCliInstallProgress((prev) => ({
        ...prev,
        [progress.appType]: message,
      }));
      if (progress.phase === 'starting' || progress.phase === 'installing' || progress.phase === 'verifying') {
        setAgentCliInstallingAppType(progress.appType);
      }
      if (progress.phase === 'success' || progress.phase === 'error' || progress.phase === 'unsupported') {
        setAgentCliInstallingAppType((current) => (
          current === progress.appType ? null : current
        ));
        if (progress.phase === 'success') {
          void refreshAgentEnvironmentSnapshot();
        }
      }
    });
    return unsubscribe;
  }, []);

  const loadAgentProviders = useCallback(async (appType: ExternalAgentProviderAppType) => {
    setAgentProviderLoadingAppType(appType);
    try {
      const result = await coworkService.listAgentProviders(appType);
      if (result.success) {
        setAgentProviderLists((prev) => ({
          ...prev,
          [appType]: result,
        }));
      }
      return result;
    } finally {
      setAgentProviderLoadingAppType((current) => (current === appType ? null : current));
    }
  }, []);

  useEffect(() => {
    if (!selectedExternalAgentAppType) return;
    void loadAgentProviders(selectedExternalAgentAppType);
  }, [loadAgentProviders, selectedExternalAgentAppType]);

  useEffect(() => {
    let active = true;
    void coworkService.getOpenClawEngineStatus().then((status) => {
      if (!active || !status) return;
      setOpenClawEngineStatus(status);
    });
    const unsubscribe = coworkService.onOpenClawEngineStatus((status) => {
      if (!active) return;
      setOpenClawEngineStatus(status);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void coworkService.getHermesEngineStatus().then((status) => {
      if (!active || !status) return;
      setHermesEngineStatus(status);
    });
    const unsubscribe = coworkService.onHermesEngineStatus((status) => {
      if (!active) return;
      setHermesEngineStatus(status);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const config = configService.getConfig();
      
      // Set general settings
      initialThemeRef.current = config.theme;
      initialLanguageRef.current = config.language;
      setTheme(config.theme);
      setLanguage(config.language);
      setUseSystemProxy(config.useSystemProxy ?? false);
      const savedTestMode = config.app?.testMode ?? false;
      setTestMode(savedTestMode);
      if (savedTestMode) setTestModeUnlocked(true);

      // Load auto-launch setting
      window.electron.autoLaunch.get().then(({ enabled }) => {
        setAutoLaunchState(enabled);
      }).catch(err => {
        console.error('Failed to load auto-launch setting:', err);
      });

      // Load prevent-sleep setting
      window.electron.preventSleep.get().then(({ enabled }) => {
        setPreventSleepState(enabled);
      }).catch(err => {
        console.error('Failed to load prevent-sleep setting:', err);
      });

      // Set up providers based on saved config
      if (config.api) {
        // For backward compatibility with older config
        // Initialize active provider based on baseUrl
        const normalizedApiBaseUrl = config.api.baseUrl.toLowerCase();
        if (normalizedApiBaseUrl.includes('openai')) {
          setActiveProvider('openai');
          setProviders(prev => ({
            ...prev,
            openai: {
              ...prev.openai,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('deepseek')) {
          setActiveProvider('deepseek');
          setProviders(prev => ({
            ...prev,
            deepseek: {
              ...prev.deepseek,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('moonshot.ai') || normalizedApiBaseUrl.includes('moonshot.cn')) {
          setActiveProvider('moonshot');
          setProviders(prev => ({
            ...prev,
            moonshot: {
              ...prev.moonshot,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('bigmodel.cn')) {
          setActiveProvider('zhipu');
          setProviders(prev => ({
            ...prev,
            zhipu: {
              ...prev.zhipu,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('minimax')) {
          setActiveProvider('minimax');
          setProviders(prev => ({
            ...prev,
            minimax: {
              ...prev.minimax,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('openapi.youdao.com')) {
          setActiveProvider('youdaozhiyun');
          setProviders(prev => ({
            ...prev,
            youdaozhiyun: {
              ...prev.youdaozhiyun,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('dashscope')) {
          setActiveProvider('qwen');
          setProviders(prev => ({
            ...prev,
            qwen: {
              ...prev.qwen,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('stepfun')) {
          setActiveProvider('stepfun');
          setProviders(prev => ({
            ...prev,
            stepfun: {
              ...prev.stepfun,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('openrouter.ai')) {
          setActiveProvider('openrouter');
          setProviders(prev => ({
            ...prev,
            openrouter: {
              ...prev.openrouter,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('googleapis')) {
          setActiveProvider('gemini');
          setProviders(prev => ({
            ...prev,
            gemini: {
              ...prev.gemini,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('anthropic')) {
          setActiveProvider('anthropic');
          setProviders(prev => ({
            ...prev,
            anthropic: {
              ...prev.anthropic,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('ollama') || normalizedApiBaseUrl.includes('11434')) {
          setActiveProvider('ollama');
          setProviders(prev => ({
            ...prev,
            ollama: {
              ...prev.ollama,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        }
      }
      
      // Load provider-specific configurations if available
      // 合并已保存的配置和默认配置，确保新添加的 provider 能被显示
      if (config.providers) {
        setProviders(prev => {
          const merged = {
            ...prev,  // 保留默认的 providers（包括新添加的 anthropic）
            ...config.providers,  // 覆盖已保存的配置
          };

          // After merging, find the first enabled provider to set as activeProvider
          // This ensures we don't use stale activeProvider from old config.api.baseUrl
          const firstEnabledProvider = providerKeys.find(providerKey => merged[providerKey]?.enabled);
          if (firstEnabledProvider) {
            setActiveProvider(firstEnabledProvider);
          }

          return Object.fromEntries(
            Object.entries(merged).map(([providerKey, providerConfig]) => {
              const models = providerConfig.models?.map((model, idx) => {
                let id = model.id;
                // Fix corrupted model IDs from previous OAuth mutation bug
                if (providerKey === 'qwen' && (id === 'vision-model' || id === 'coder-model')) {
                  const defaultModel = defaultConfig.providers?.qwen?.models?.[idx];
                  id = defaultModel?.id || (model.supportsImage ? 'qwen3.5-plus' : 'qwen3-coder-plus');
                }
                return {
                  ...model,
                  id,
                  supportsImage: model.supportsImage ?? false,
                };
              });
              return [
                providerKey,
                {
                  ...providerConfig,
                  apiFormat: getEffectiveApiFormat(providerKey, (providerConfig as ProviderConfig).apiFormat),
                  models,
                },
              ];
            })
          ) as ProvidersConfig;
        });
      }
      
      // 加载快捷键设置
      if (config.shortcuts) {
        setShortcuts(prev => ({
          ...prev,
          ...config.shortcuts,
        }));
      }
    } catch (error) {
      setError('Failed to load settings');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (didSaveRef.current) {
        return;
      }
      themeService.restoreTheme(initialThemeIdRef.current, initialThemeRef.current);
      i18nService.setLanguage(initialLanguageRef.current, { persist: false });
    };
  }, []);

  // 监听标签页切换，确保内容区域滚动到顶部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    // The initial noticeMessage is computed once by useSettingsSharedState.
    // We do not recompute on prop changes after mount — that matches the
    // original behavior (lazy useState initializer runs only on first mount).
  }, []);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Subscribe to language changes
  useEffect(() => {
    const unsubscribe = i18nService.subscribe(() => {
      setLanguage(i18nService.getLanguage());
      // Re-translate notice message on language change
      if (noticeI18nKey) {
        const base = i18nService.t(noticeI18nKey);
        setNoticeMessage(noticeExtra ? `${base} (${noticeExtra})` : base);
      }
    });
    return unsubscribe;
  }, [noticeI18nKey, noticeExtra]);

  // Compute visible providers based on language, including active custom_N entries
  const visibleProviders = useMemo(() => {
    const visibleKeys = getVisibleProviders(language);
    const filtered: Partial<ProvidersConfig> = {};
    for (const key of visibleKeys) {
      if (providers[key as keyof ProvidersConfig]) {
        filtered[key as keyof ProvidersConfig] = providers[key as keyof ProvidersConfig];
      }
    }
    // Append custom_N providers that exist in state, sorted by numeric suffix
    for (const key of CUSTOM_PROVIDER_KEYS) {
      if (providers[key]) {
        filtered[key] = providers[key];
      }
    }
    return filtered as ProvidersConfig;
  }, [language, providers]);

  // Ensure activeProvider is always in visibleProviders when language changes
  useEffect(() => {
    const visibleKeys = Object.keys(visibleProviders) as ProviderType[];
    if (visibleKeys.length > 0 && !visibleKeys.includes(activeProvider)) {
      // If current activeProvider is not visible, switch to first visible provider
      const firstEnabledVisible = visibleKeys.find(key => visibleProviders[key]?.enabled);
      setActiveProvider(firstEnabledVisible ?? visibleKeys[0]);
    }
  }, [visibleProviders, activeProvider]);

  // Handle adding a new custom provider
  const handleAddCustomProvider = () => {
    // Find the first unused custom slot
    const usedKeys = new Set(Object.keys(providers));
    const newKey = CUSTOM_PROVIDER_KEYS.find(k => !usedKeys.has(k));
    if (!newKey) return; // All 10 slots used
    setProviders(prev => ({
      ...prev,
      [newKey]: {
        enabled: false,
        apiKey: '',
        baseUrl: '',
        apiFormat: 'openai' as const,
        models: [],
        displayName: undefined,
      },
    }));
    setActiveProvider(newKey);
    setShowApiKey(false);
    handleCancelModelEdit();
  };

  // Handle deleting a custom provider
  const handleDeleteCustomProvider = (key: ProviderType) => {
    setPendingDeleteProvider(key);
  };

  const confirmDeleteCustomProvider = () => {
    const key = pendingDeleteProvider;
    if (!key) return;
    setPendingDeleteProvider(null);
    setProviders(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    // Persist the deletion immediately so it survives window close
    const currentConfig = configService.getConfig();
    const updatedProviders = { ...currentConfig.providers };
    delete updatedProviders[key];
    configService.updateConfig({ providers: updatedProviders as AppConfig['providers'] });
    // If the deleted provider was active, switch to first visible
    if (activeProvider === key) {
      const visibleKeys = Object.keys(visibleProviders).filter(k => k !== key) as ProviderType[];
      const firstEnabled = visibleKeys.find(k => visibleProviders[k]?.enabled);
      setActiveProvider(firstEnabled ?? visibleKeys[0] ?? providerKeys[0]);
    }
  };

  // Handle provider change
  const handleProviderChange = (provider: ProviderType) => {
    handleCancelModelEdit();
    setActiveProvider(provider);
    // 切换 provider 时清除测试结果
  };

  // Handle provider configuration change
  const handleProviderConfigChange = (provider: ProviderType, field: string, value: string) => {
    setProviders(prev => {
      if (field === 'apiFormat') {
        const nextApiFormat = getEffectiveApiFormat(provider, value);
        const nextProviderConfig: ProviderConfig = {
          ...prev[provider],
          apiFormat: nextApiFormat,
        };

        // Only auto-switch URL when current value is still a known default URL.
        if (shouldAutoSwitchProviderBaseUrl(provider, prev[provider].baseUrl)) {
          const defaultBaseUrl = getProviderDefaultBaseUrl(provider, nextApiFormat);
          if (defaultBaseUrl) {
            nextProviderConfig.baseUrl = defaultBaseUrl;
          }
        }

        return {
          ...prev,
          [provider]: nextProviderConfig,
        };
      }

      // Handle codingPlanEnabled toggle for all supported providers
      if (field === 'codingPlanEnabled') {
        const def = ProviderRegistry.get(provider);
        if (def?.codingPlanSupported) {
          const enabled = value === 'true';
          const nextModels = enabled && def.codingPlanModels
            ? def.codingPlanModels.map(m => ({ ...m }))
            : def.defaultModels.map(m => ({ ...m }));
          return {
            ...prev,
            [provider]: {
              ...prev[provider],
              codingPlanEnabled: enabled,
              models: nextModels,
            },
          };
        }
      }

      return {
        ...prev,
        [provider]: {
          ...prev[provider],
          [field]: value,
        },
      };
    });
  };

  const handleMiniMaxDeviceLogin = async (region: MiniMaxRegion) => {
    minimaxOAuthCancelRef.current = false;
    setMinimaxOAuthPhase({ kind: 'requesting_code' });

    const codeEndpoint = region === 'cn' ? MINIMAX_CODE_ENDPOINT_CN : MINIMAX_CODE_ENDPOINT_GLOBAL;
    const tokenEndpoint = region === 'cn' ? MINIMAX_TOKEN_ENDPOINT_CN : MINIMAX_TOKEN_ENDPOINT_GLOBAL;
    const defaultBaseUrl = region === 'cn' ? MINIMAX_BASE_URL_CN : MINIMAX_BASE_URL_GLOBAL;

    try {
      const { verifier, challenge, state } = await generateMiniMaxPkce();

      const codeBody = [
        'response_type=code',
        `client_id=${encodeURIComponent(MINIMAX_OAUTH_CLIENT_ID)}`,
        `scope=${encodeURIComponent(MINIMAX_OAUTH_SCOPE)}`,
        `code_challenge=${encodeURIComponent(challenge)}`,
        'code_challenge_method=S256',
        `state=${encodeURIComponent(state)}`,
      ].join('&');

      const codeRes = await window.electron.api.fetch({
        url: codeEndpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: codeBody,
      });

      if (!codeRes.ok) {
        throw new Error(`MiniMax OAuth authorization failed: ${codeRes.status}`);
      }

      const codePayload = (codeRes.data ?? {}) as {
        user_code?: string;
        verification_uri?: string;
        expired_in?: number;
        interval?: number;
        state?: string;
        error?: string;
      };

      if (!codePayload.user_code || !codePayload.verification_uri) {
        throw new Error(codePayload.error ?? 'MiniMax OAuth returned incomplete authorization payload');
      }

      if (codePayload.state !== state) {
        throw new Error('MiniMax OAuth state mismatch: possible CSRF attack or session corruption');
      }

      try {
        await window.electron.shell.openExternal(codePayload.verification_uri);
      } catch { /* ignore: user can open manually */ }

      setMinimaxOAuthPhase({
        kind: 'pending',
        userCode: codePayload.user_code,
        verificationUri: codePayload.verification_uri,
      });

      let pollIntervalMs = codePayload.interval ?? 2000;
      const expireTimeMs = codePayload.expired_in ?? (Date.now() + 5 * 60 * 1000);

      while (Date.now() < expireTimeMs) {
        if (minimaxOAuthCancelRef.current) {
          setMinimaxOAuthPhase({ kind: 'idle' });
          return;
        }

        await new Promise(r => setTimeout(r, pollIntervalMs));

        if (minimaxOAuthCancelRef.current) {
          setMinimaxOAuthPhase({ kind: 'idle' });
          return;
        }

        const tokenBody = [
          `grant_type=${encodeURIComponent(MINIMAX_OAUTH_GRANT_TYPE)}`,
          `client_id=${encodeURIComponent(MINIMAX_OAUTH_CLIENT_ID)}`,
          `user_code=${encodeURIComponent(codePayload.user_code)}`,
          `code_verifier=${encodeURIComponent(verifier)}`,
        ].join('&');

        const tokenRes = await window.electron.api.fetch({
          url: tokenEndpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: tokenBody,
        });

        const tokenPayload = (tokenRes.data ?? {}) as {
          status?: string;
          access_token?: string;
          refresh_token?: string;
          expired_in?: number;
          resource_url?: string;
          notification_message?: string;
          base_resp?: { status_code?: number; status_msg?: string };
        };

        if (tokenPayload.status === 'error') {
          throw new Error(tokenPayload.base_resp?.status_msg ?? 'MiniMax OAuth error');
        }

        if (tokenPayload.status === 'success') {
          if (!tokenPayload.access_token || !tokenPayload.refresh_token) {
            throw new Error('MiniMax OAuth returned incomplete token payload');
          }

          let baseUrl = (tokenPayload.resource_url ?? '').trim();
          if (baseUrl && !baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
          }
          if (!baseUrl) {
            baseUrl = defaultBaseUrl;
          }

          setProviders(prev => ({
            ...prev,
            minimax: {
              ...prev.minimax,
              enabled: true,
              apiKey: tokenPayload.access_token!,
              baseUrl,
              apiFormat: 'anthropic',
              authType: 'oauth',
              oauthRefreshToken: tokenPayload.refresh_token,
              oauthTokenExpiresAt: tokenPayload.expired_in,
              models: [...(defaultConfig.providers?.minimax.models ?? [])],
            },
          }));

          setMinimaxOAuthPhase({ kind: 'success' });
          setTimeout(() => setMinimaxOAuthPhase({ kind: 'idle' }), 1500);
          return;
        }

        // Still pending — back off gradually
        pollIntervalMs = Math.min(pollIntervalMs * 1.5, 10000);
      }

      throw new Error('MiniMax OAuth timed out waiting for authorization');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMinimaxOAuthPhase({ kind: 'error', message });
    }
  };

  const handleCancelMiniMaxLogin = () => {
    minimaxOAuthCancelRef.current = true;
    setMinimaxOAuthPhase({ kind: 'idle' });
  };

  const handleMiniMaxOAuthLogout = () => {
    setProviders(prev => ({
      ...prev,
      minimax: {
        ...prev.minimax,
        apiKey: '',
        oauthRefreshToken: undefined,
        oauthTokenExpiresAt: undefined,
      },
    }));
    setMinimaxOAuthPhase({ kind: 'idle' });
  };

  const hasCoworkConfigChanges = coworkAgentEngine !== coworkConfig.agentEngine
    || openclawConfigSource !== coworkConfig.openclawConfigSource
    || claudeCodeConfigSource !== coworkConfig.claudeCodeConfigSource
    || claudeCodePermissionMode !== coworkConfig.claudeCodePermissionMode
    || codexConfigSource !== coworkConfig.codexConfigSource
    || hermesConfigSource !== coworkConfig.hermesConfigSource
    || opencodeConfigSource !== coworkConfig.opencodeConfigSource
    || opencodePermissionMode !== coworkConfig.opencodePermissionMode
    || deepseekTuiConfigSource !== coworkConfig.deepseekTuiConfigSource
    || deepseekTuiPermissionMode !== coworkConfig.deepseekTuiPermissionMode
    || coworkMemoryEnabled !== coworkConfig.memoryEnabled
    || coworkMemoryLlmJudgeEnabled !== coworkConfig.memoryLlmJudgeEnabled;
  const hasCoworkAgentEngineApplyChanges = coworkAgentEngine !== coworkConfig.agentEngine
    || (coworkAgentEngine === CoworkAgentEngineValue.OpenClaw
      && openclawConfigSource !== coworkConfig.openclawConfigSource)
    || (coworkAgentEngine === CoworkAgentEngineValue.ClaudeCode
      && (claudeCodeConfigSource !== coworkConfig.claudeCodeConfigSource
        || claudeCodePermissionMode !== coworkConfig.claudeCodePermissionMode))
    || (coworkAgentEngine === CoworkAgentEngineValue.Codex
      && codexConfigSource !== coworkConfig.codexConfigSource)
    || (coworkAgentEngine === CoworkAgentEngineValue.Hermes
      && hermesConfigSource !== coworkConfig.hermesConfigSource)
    || (coworkAgentEngine === CoworkAgentEngineValue.OpenCode
      && (opencodeConfigSource !== coworkConfig.opencodeConfigSource
        || opencodePermissionMode !== coworkConfig.opencodePermissionMode))
    || (coworkAgentEngine === CoworkAgentEngineValue.DeepSeekTui
      && (deepseekTuiConfigSource !== coworkConfig.deepseekTuiConfigSource
        || deepseekTuiPermissionMode !== coworkConfig.deepseekTuiPermissionMode));
  const isCoworkAgentConfigApplying = isSaving
    && activeTab === 'coworkAgentEngine'
    && hasCoworkAgentEngineApplyChanges;

  const loadCoworkMemoryData = useCallback(async () => {
    setCoworkMemoryListLoading(true);
    try {
      const [entries, stats] = await Promise.all([
        coworkService.listMemoryEntries({
          query: coworkMemoryQuery.trim() || undefined,
        }),
        coworkService.getMemoryStats(),
      ]);
      setCoworkMemoryEntries(entries);
      setCoworkMemoryStats(stats);
    } catch (loadError) {
      console.error('Failed to load cowork memory data:', loadError);
      setCoworkMemoryEntries([]);
      setCoworkMemoryStats(null);
    } finally {
      setCoworkMemoryListLoading(false);
    }
  }, [
    coworkMemoryQuery,
  ]);

  useEffect(() => {
    if (activeTab !== 'coworkMemory') return;
    void loadCoworkMemoryData();
  }, [activeTab, loadCoworkMemoryData]);

  /**
   * Detect OpenClaw default template content and return empty string.
   * Templates contain YAML frontmatter and specific marker phrases.
   */
  const stripDefaultTemplate = (content: string): string => {
    if (!content.trim()) return '';
    const TEMPLATE_MARKERS = [
      'Fill this in during your first conversation',
      "You're not a chatbot. You're becoming someone",
      'Learn about the person you\'re helping',
    ];
    if (TEMPLATE_MARKERS.some((m) => content.includes(m))) return '';
    return content;
  };

  useEffect(() => {
    if (activeTab !== 'coworkAgent') return;
    if (!bootstrapLoaded) {
      void (async () => {
        const [identity, user, soul] = await Promise.all([
          coworkService.readBootstrapFile('IDENTITY.md'),
          coworkService.readBootstrapFile('USER.md'),
          coworkService.readBootstrapFile('SOUL.md'),
        ]);
        setBootstrapIdentity(stripDefaultTemplate(identity));
        setBootstrapUser(stripDefaultTemplate(user));
        setBootstrapSoul(stripDefaultTemplate(soul));
        setBootstrapLoaded(true);
      })();
    }
  }, [activeTab, bootstrapLoaded]);

  const resetCoworkMemoryEditor = () => {
    setCoworkMemoryEditingId(null);
    setCoworkMemoryDraftText('');
    setShowMemoryModal(false);
  };

  const handleSaveCoworkMemoryEntry = async () => {
    const text = coworkMemoryDraftText.trim();
    if (!text) return;

    setCoworkMemoryListLoading(true);
    try {
      if (coworkMemoryEditingId) {
        await coworkService.updateMemoryEntry({
          id: coworkMemoryEditingId,
          text,
        });
      } else {
        await coworkService.createMemoryEntry({
          text,
        });
      }
      resetCoworkMemoryEditor();
      await loadCoworkMemoryData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : i18nService.t('coworkMemoryCrudSaveFailed'));
    } finally {
      setCoworkMemoryListLoading(false);
    }
  };

  const handleEditCoworkMemoryEntry = (entry: CoworkUserMemoryEntry) => {
    setCoworkMemoryEditingId(entry.id);
    setCoworkMemoryDraftText(entry.text);
    setShowMemoryModal(true);
  };

  const handleDeleteCoworkMemoryEntry = async (entry: CoworkUserMemoryEntry) => {
    setCoworkMemoryListLoading(true);
    try {
      await coworkService.deleteMemoryEntry({ id: entry.id });
      if (coworkMemoryEditingId === entry.id) {
        resetCoworkMemoryEditor();
      }
      await loadCoworkMemoryData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : i18nService.t('coworkMemoryCrudDeleteFailed'));
    } finally {
      setCoworkMemoryListLoading(false);
    }
  };

  const handleOpenCoworkMemoryModal = () => {
    resetCoworkMemoryEditor();
    setShowMemoryModal(true);
  };

  // Toggle provider enabled status
  const toggleProviderEnabled = (provider: ProviderType) => {
    const providerConfig = providers[provider];
    const isEnabling = !providerConfig.enabled;
    const missingApiKey = providerRequiresApiKey(provider) && !providerConfig.apiKey.trim();

    if (isEnabling && missingApiKey) {
      setError(i18nService.t('apiKeyRequired'));
      return;
    }

    // GitHub Copilot requires device code auth — redirect to sign-in flow
    if (provider === 'github-copilot' && isEnabling && !providerConfig.apiKey.trim()) {
      handleCopilotSignIn();
      return;
    }

    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        enabled: !prev[provider].enabled
      }
    }));
  };

  const enableProvider = (provider: ProviderType) => {
    setProviders(prev => {
      if (prev[provider].enabled) {
        return prev;
      }

      return {
        ...prev,
        [provider]: {
          ...prev[provider],
          enabled: true,
        },
      };
    });
  };

  // GitHub Copilot device code authentication
  const handleCopilotSignIn = async () => {
    try {
      setCopilotAuthStatus('requesting');
      setCopilotError(null);

      // Step 1: Request device code
      const { userCode, verificationUri, deviceCode, interval, expiresIn } =
        await window.electron.githubCopilot.requestDeviceCode();

      setCopilotUserCode(userCode);
      setCopilotVerificationUri(verificationUri);
      setCopilotAuthStatus('awaiting_user');

      // Open verification URL in browser
      await window.electron.shell.openExternal(verificationUri);

      // Step 2: Poll for token
      setCopilotAuthStatus('polling');
      const result = await window.electron.githubCopilot.pollForToken(deviceCode, interval, expiresIn);

      if (result.success && result.token) {
        setCopilotGithubUser(result.githubUser || '');
        setCopilotAuthStatus('authenticated');

        // Store the Copilot API token in the provider's apiKey field
        handleProviderConfigChange('github-copilot', 'apiKey', result.token);
        if (result.baseUrl) {
          handleProviderConfigChange('github-copilot', 'baseUrl', result.baseUrl);
        }
        // Auto-enable the provider
        enableProvider('github-copilot');
      } else {
        setCopilotError(result.error || 'Authentication failed');
        setCopilotAuthStatus('error');
      }
    } catch (error: any) {
      setCopilotError(error.message || 'Authentication failed');
      setCopilotAuthStatus('error');
    }
  };

  const handleCopilotSignOut = async () => {
    try {
      await window.electron.githubCopilot.signOut();
      setCopilotAuthStatus('idle');
      setCopilotGithubUser('');
      setCopilotUserCode('');
      setCopilotError(null);
      // Clear the token from provider config
      handleProviderConfigChange('github-copilot', 'apiKey', '');
      // Disable the provider
      setProviders(prev => ({
        ...prev,
        'github-copilot': { ...prev['github-copilot'], enabled: false },
      }));
    } catch (error) {
      console.error('[Settings] GitHub Copilot sign-out failed:', error);
    }
  };

  const handleCopilotCancelAuth = async () => {
    try {
      await window.electron.githubCopilot.cancelPolling();
      setCopilotAuthStatus('idle');
      setCopilotUserCode('');
      setCopilotError(null);
    } catch (error) {
      console.error('[Settings] GitHub Copilot cancel polling failed:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const normalizedProviders = Object.fromEntries(
        Object.entries(providers).map(([providerKey, providerConfig]) => {
          const apiFormat = getEffectiveApiFormat(providerKey, providerConfig.apiFormat);
          return [
            providerKey,
            {
              ...providerConfig,
              apiFormat,
              baseUrl: resolveBaseUrl(providerKey as ProviderType, providerConfig.baseUrl, apiFormat),
            },
          ];
        })
      ) as ProvidersConfig;

      // Find the first enabled provider to use as the primary API
      const firstEnabledProvider = Object.entries(normalizedProviders).find(
        ([_, config]) => config.enabled
      );

      const primaryProvider = firstEnabledProvider
        ? firstEnabledProvider[1]
        : normalizedProviders[activeProvider];

      await configService.updateConfig({
        api: {
          key: primaryProvider.apiKey,
          baseUrl: primaryProvider.baseUrl,
        },
        providers: normalizedProviders, // Save all providers configuration
        theme,
        language,
        useSystemProxy,
        shortcuts,
        app: {
          ...configService.getConfig().app,
          testMode,
        },
      });

      // 应用主题
      themeService.setTheme(theme);

      // 应用语言
      i18nService.setLanguage(language, { persist: false });

      // Set API with the primary provider - handle Qwen OAuth
      let apiKeyToUse = primaryProvider.apiKey;
      let baseUrlToUse = primaryProvider.baseUrl;

      // For Qwen provider, check if OAuth should be used
      if (firstEnabledProvider && firstEnabledProvider[0] === 'qwen') {
        const qwenConfig = firstEnabledProvider[1] as any;
        if (!qwenConfig.apiKey && qwenConfig.oauthCredentials) {
          // Use OAuth token as API key placeholder
          apiKeyToUse = 'qwen-oauth';
          baseUrlToUse = qwenConfig.oauthCredentials.resourceUrl || qwenConfig.baseUrl;
        }
      }

      apiService.setConfig({
        apiKey: apiKeyToUse,
        baseUrl: baseUrlToUse,
      });

      // 更新 Redux store 中的可用模型列表
      const allModels: { id: string; name: string; provider?: string; providerKey?: string; supportsImage?: boolean }[] = [];
      Object.entries(normalizedProviders).forEach(([providerName, config]) => {
        if (config.enabled && config.models) {
          config.models.forEach(model => {
            allModels.push({
              id: model.id,
              name: model.name,
              provider: getProviderDisplayName(providerName, config),
              providerKey: providerName,
              supportsImage: model.supportsImage ?? false,
            });
          });
        }
      });
      dispatch(setAvailableModels(allModels));

      if (hasCoworkConfigChanges) {
        const updated = await coworkService.updateConfig({
          agentEngine: coworkAgentEngine,
          openclawConfigSource,
          claudeCodeConfigSource,
          claudeCodePermissionMode,
          codexConfigSource,
          hermesConfigSource,
          opencodeConfigSource,
          opencodePermissionMode,
          deepseekTuiConfigSource,
          deepseekTuiPermissionMode,
          memoryEnabled: coworkMemoryEnabled,
          memoryLlmJudgeEnabled: coworkMemoryLlmJudgeEnabled,
        });
        if (!updated) {
          throw new Error(i18nService.t('coworkConfigSaveFailed'));
        }
      }

      // Save bootstrap files (IDENTITY.md, USER.md, SOUL.md) only if loaded
      if (bootstrapLoaded) {
        const results = await Promise.all([
          coworkService.writeBootstrapFile('IDENTITY.md', bootstrapIdentity),
          coworkService.writeBootstrapFile('USER.md', bootstrapUser),
          coworkService.writeBootstrapFile('SOUL.md', bootstrapSoul),
        ]);
        if (results.some(r => !r)) {
          throw new Error(i18nService.t('coworkBootstrapSaveFailed'));
        }
      }

      // Sync IM gateway config (regenerate openclaw.json and restart gateway if running).
      // This is done on every save regardless of activeTab, because the user may have
      // edited IM config then switched tabs before clicking Save.
      await imService.saveAndSyncConfig();

      didSaveRef.current = true;
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // 标签页切换处理
  const handleTabChange = (tab: TabType) => {
    if (tab !== 'model') {
      handleCancelModelEdit();
    }
    setActiveTab(tab);
  };

  // 快捷键更新处理
  const handleShortcutChange = (key: keyof typeof shortcuts, value: string) => {
    setShortcuts(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 阻止点击设置窗口时事件传播到背景
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Handlers for model operations
  const {
    isAddingModel,
    isEditingModel,
    newModelName,
    setNewModelName,
    newModelId,
    setNewModelId,
    newModelSupportsImage,
    setNewModelSupportsImage,
    modelFormError,
    setModelFormError,
    handleAddModel,
    handleEditModel,
    handleDeleteModel,
    handleSaveNewModel,
    handleCancelModelEdit,
    handleModelDialogKeyDown,
  } = modelEditor;

  const sidebarTabs: { key: TabType; label: string; icon: React.ReactNode }[] = useMemo(() => {
    const allTabs = [
      { key: 'general' as TabType,        label: i18nService.t('general'),        icon: <Cog6ToothIcon className="h-5 w-5" /> },
      { key: 'coworkAgentEngine' as TabType, label: i18nService.t('coworkAgentEngine'), icon: <CpuChipIcon className="h-5 w-5" /> },
      { key: 'model' as TabType,          label: i18nService.t('model'),          icon: <CubeIcon className="h-5 w-5" /> },
      { key: 'im' as TabType,             label: i18nService.t('imBot'),          icon: <ChatBubbleLeftIcon className="h-5 w-5" /> },
      { key: 'email' as TabType,          label: i18nService.t('emailTab'),       icon: <EnvelopeIcon className="h-5 w-5" /> },
      { key: 'scheduledTasks' as TabType, label: i18nService.t('scheduledTasksTitle'), icon: <ClockIcon className="h-5 w-5" /> },
      { key: 'mcp' as TabType,            label: i18nService.t('mcpServers'),     icon: <ConnectorIcon className="h-5 w-5" /> },
      { key: 'coworkMemory' as TabType,   label: i18nService.t('coworkMemoryTitle'), icon: <BrainIcon className="h-5 w-5" /> },
      { key: 'coworkAgent' as TabType,    label: i18nService.t('coworkAgentTab'),    icon: <UserCircleIcon className="h-5 w-5" /> },
      { key: 'agents' as TabType,         label: i18nService.t('agentManagement'), icon: <UserGroupIcon className="h-5 w-5" /> },
      { key: 'shortcuts' as TabType,      label: i18nService.t('shortcuts'),      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><rect x="2" y="4" width="20" height="14" rx="2" /><line x1="6" y1="8" x2="8" y2="8" /><line x1="10" y1="8" x2="12" y2="8" /><line x1="14" y1="8" x2="16" y2="8" /><line x1="6" y1="12" x2="8" y2="12" /><line x1="10" y1="12" x2="14" y2="12" /><line x1="16" y1="12" x2="18" y2="12" /><line x1="8" y1="15.5" x2="16" y2="15.5" /></svg> },
      { key: 'about' as TabType,          label: i18nService.t('about'),          icon: <InformationCircleIcon className="h-5 w-5" /> },
    ];
    // Filter out tabs hidden by enterprise config
    const ui = enterpriseConfig?.ui;
    if (ui) {
      return allTabs.filter(tab => ui[`settings.${tab.key}`] !== 'hide');
    }
    return allTabs;
  }, [language, enterpriseConfig]);

  const activeTabLabel = useMemo(() => {
    return sidebarTabs.find(t => t.key === activeTab)?.label ?? '';
  }, [activeTab, sidebarTabs]);

  const selectedAgentConfigSource = useMemo<ExternalAgentConfigSource | null>(() => {
    if (selectedExternalAgentAppType === 'claude') return claudeCodeConfigSource;
    if (selectedExternalAgentAppType === 'codex') return codexConfigSource;
    if (selectedExternalAgentAppType === 'hermes') return hermesConfigSource;
    if (selectedExternalAgentAppType === 'opencode') return opencodeConfigSource;
    if (selectedExternalAgentAppType === 'deepseek_tui') return deepseekTuiConfigSource;
    return null;
  }, [
    claudeCodeConfigSource,
    codexConfigSource,
    deepseekTuiConfigSource,
    hermesConfigSource,
    deepseekTuiConfigSource,
    selectedExternalAgentAppType,
  ]);

  const setSelectedAgentConfigSource = (source: ExternalAgentConfigSource) => {
    if (isSaving) return;
    if (selectedExternalAgentAppType === 'claude') {
      setClaudeCodeConfigSource(source);
      return;
    }
    if (selectedExternalAgentAppType === 'codex') {
      setCodexConfigSource(source);
      return;
    }
    if (selectedExternalAgentAppType === 'hermes') {
      setHermesConfigSource(source);
      return;
    }
    if (selectedExternalAgentAppType === 'opencode') {
      setOpenCodeConfigSource(source);
      return;
    }
    if (selectedExternalAgentAppType === 'deepseek_tui') {
      setDeepSeekTuiConfigSource(source);
    }
  };

  const selectedAgentProviderList = selectedExternalAgentAppType
    ? agentProviderLists[selectedExternalAgentAppType] ?? null
    : null;
  const selectedAgentProvider = useMemo<ExternalAgentProvider | null>(() => {
    const providers = selectedAgentProviderList?.providers ?? [];
    return providers.find((provider) => provider.id === selectedAgentProviderList?.currentProviderId)
      ?? providers.find((provider) => provider.isCurrent)
      ?? providers[0]
      ?? null;
  }, [selectedAgentProviderList]);

  const currentModelSummary = useMemo(() => {
    const config = configService.getConfig();
    const providerKey = config.model?.defaultModelProvider || activeProvider;
    const providerConfig = providers[providerKey as ProviderType];
    const modelId = config.model?.defaultModel || providerConfig?.models?.[0]?.id || '';
    const providerName = providerConfig
      ? getProviderDisplayName(providerKey, providerConfig)
      : providerKey;
    const apiFormat = providerConfig
      ? getEffectiveApiFormat(providerKey, providerConfig.apiFormat)
      : undefined;
    return {
      providerKey,
      providerName,
      modelId,
      apiFormat,
      baseUrl: providerConfig?.baseUrl ?? '',
    };
  }, [activeProvider, providers]);

  const effectiveAgentModelSummary = useMemo(() => {
    if (selectedAgentConfigSource === ExternalAgentConfigSourceValue.LocalCli && selectedAgentProvider) {
      return {
        providerKey: selectedAgentProvider.id,
        providerName: selectedAgentProvider.name,
        modelId: selectedAgentProvider.summary.model || i18nService.t('coworkAgentLocalModelUnknown'),
        apiFormat: selectedExternalAgentAppType === 'claude' ? 'anthropic' : 'openai',
        baseUrl: selectedAgentProvider.summary.baseUrl,
      };
    }
    return currentModelSummary;
  }, [currentModelSummary, selectedAgentConfigSource, selectedAgentProvider, selectedExternalAgentAppType]);

  const handleSelectAgentProvider = async (providerId: string) => {
    if (!selectedExternalAgentAppType || !providerId || agentProviderSwitchingId) return;
    setAgentProviderSwitchingId(providerId);
    setError(null);
    try {
      const result = await coworkService.setCurrentAgentProvider(selectedExternalAgentAppType, providerId);
      if (!result.success) {
        setError(result.error || i18nService.t('coworkAgentLocalModelSwitchFailed'));
        return;
      }
      setAgentProviderLists((prev) => ({
        ...prev,
        [selectedExternalAgentAppType]: result,
      }));
      window.dispatchEvent(new CustomEvent('agora-agent-provider-changed', {
        detail: { appType: selectedExternalAgentAppType },
      }));
    } finally {
      setAgentProviderSwitchingId(null);
    }
  };

  const refreshAgentEnvironmentSnapshot = async () => {
    const snapshot = await coworkService.getAgentEngineSnapshot();
    setAgentEnvironmentSnapshot(snapshot);
  };

  const handleInstallAgentCli = async (appType: ExternalAgentProviderAppType) => {
    if (window.electron?.platform !== 'darwin') {
      setError(i18nService.t('coworkAgentEngineInstallCliUnsupported'));
      return;
    }
    setError(null);
    setAgentCliInstallingAppType(appType);
    setAgentCliInstallProgress((prev) => ({
      ...prev,
      [appType]: i18nService.t('coworkAgentEngineInstallCliStarting'),
    }));
    try {
      const result = await coworkService.installAgentCli(appType);
      if (result.snapshot) {
        setAgentEnvironmentSnapshot(result.snapshot);
      } else {
        await refreshAgentEnvironmentSnapshot();
      }
      if (!result.success) {
        setError(result.error || i18nService.t('coworkAgentEngineInstallCliFailed'));
        return;
      }
      if (appType === 'hermes') {
        setHermesConfigSource(ExternalAgentConfigSourceValue.AgoraModel);
      }
      setNoticeMessage(i18nService.t('coworkAgentEngineInstallCliSuccess'));
      setAgentCliInstallProgress((prev) => ({
        ...prev,
        [appType]: result.version || result.binaryPath || i18nService.t('coworkAgentEngineInstallCliSuccess'),
      }));
    } finally {
      setAgentCliInstallingAppType((current) => (
        current === appType ? null : current
      ));
    }
  };

  const handleInstallHermesEngine = async () => {
    if (window.electron?.platform !== 'darwin') {
      setError(i18nService.t('coworkAgentEngineInstallCliUnsupported'));
      return;
    }
    setError(null);
    setAgentCliInstallingAppType('hermes');
    setAgentCliInstallProgress((prev) => ({
      ...prev,
      hermes: i18nService.t('coworkAgentEngineInstallCliStarting'),
    }));
    setHermesEngineStatus((current) => ({
      phase: 'installing',
      version: current?.version ?? null,
      progressPercent: 8,
      message: i18nService.t('coworkHermesInstalling'),
      canRetry: false,
    }));
    try {
      const status = await coworkService.installHermesEngine();
      if (status) {
        setHermesEngineStatus(status);
      }
      await refreshAgentEnvironmentSnapshot();
      if (!status || status.phase === 'error' || status.phase === 'not_installed') {
        setError(status?.message || i18nService.t('coworkAgentEngineInstallCliFailed'));
        return;
      }
      setHermesConfigSource(ExternalAgentConfigSourceValue.AgoraModel);
      setNoticeMessage(i18nService.t('coworkAgentEngineInstallCliSuccess'));
    } finally {
      setAgentCliInstallingAppType((current) => (
        current === 'hermes' ? null : current
      ));
    }
  };

  const handleInstallOpenClawEngine = () => coworkService.installOpenClawEngine();
  const handleRestartOpenClawGateway = () => coworkService.restartOpenClawGateway();
  const handleRestartHermesGateway = () => coworkService.restartHermesGateway();

  const selectedEngineConfigPaths = useMemo<string[]>(() => {
    if (!selectedExternalAgentAppType) return [];
    const engine = agentEnvironmentSnapshot?.engines.find(
      (item) => item.appType === selectedExternalAgentAppType,
    );
    if (!engine) return [];
    return [
      engine.config.primaryConfigPath,
      ...(engine.config.secondaryConfigPaths ?? []),
    ].filter(Boolean) as string[];
  }, [agentEnvironmentSnapshot, selectedExternalAgentAppType]);

  const applyImportedModelProviderToState = (
    providerKey: string | undefined,
    providerConfig: {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
      apiFormat?: 'anthropic' | 'openai' | 'gemini';
      displayName?: string;
      models?: Array<{ id: string; name: string; supportsImage?: boolean }>;
    } | undefined,
  ) => {
    if (!providerKey || !providerConfig) return;
    setProviders(prev => ({
      ...prev,
      [providerKey]: providerConfig as ProviderConfig,
    }));
    if ((providerKeys as readonly string[]).includes(providerKey)) {
      setActiveProvider(providerKey as ProviderType);
    }
  };

  const handleImportLocalAgentConfigToModelSettings = async () => {
    if (!selectedExternalAgentAppType) return;
    setError(null);
    setAgentConfigImportingAppType(selectedExternalAgentAppType);
    try {
      const result = await coworkService.importLocalAgentConfigToModelSettings(selectedExternalAgentAppType);
      if (!result.success) {
        setError(result.error || i18nService.t('coworkAgentConfigImportModelFailed'));
        return;
      }
      applyImportedModelProviderToState(result.providerKey, result.providerConfig);
      setNoticeMessage(result.duplicate
        ? i18nService.t('coworkAgentConfigImportModelDuplicate')
        : i18nService.t('coworkAgentConfigImportModelSuccess'));
    } finally {
      setAgentConfigImportingAppType(null);
    }
  };

  const handleSyncOpenClawGlobalConfig = async () => {
    setError(null);
    setOpenClawGlobalSyncing(true);
    try {
      const result = await coworkService.syncOpenClawGlobalConfig();
      if (!result.success) {
        setError(result.error || i18nService.t('coworkAgentOpenClawSyncGlobalFailed'));
        return;
      }
      if (result.status) {
        setOpenClawEngineStatus(result.status);
      }
      setOpenClawConfigSource(ExternalAgentConfigSourceValue.AgoraModel);
      setNoticeMessage(i18nService.t('coworkAgentOpenClawSyncGlobalSuccess'));
    } finally {
      setOpenClawGlobalSyncing(false);
    }
  };

  const handleSyncOpenCodeGlobalConfig = async () => {
    setError(null);
    setOpenCodeGlobalSyncing(true);
    try {
      const result = await coworkService.syncOpenCodeGlobalConfig();
      if (!result.success) {
        setError(result.error || i18nService.t('coworkAgentOpenCodeSyncGlobalFailed'));
        return;
      }
      setAgentProviderLists((prev) => ({
        ...prev,
        opencode: result,
      }));
      setNoticeMessage(i18nService.t('coworkAgentOpenCodeSyncGlobalSuccess'));
      window.dispatchEvent(new CustomEvent('agora-agent-provider-changed', {
        detail: { appType: 'opencode' },
      }));
    } finally {
      setOpenCodeGlobalSyncing(false);
    }
  };

  const handleSyncDeepSeekTuiGlobalConfig = async () => {
    setError(null);
    setDeepSeekTuiGlobalSyncing(true);
    try {
      const result = await coworkService.syncDeepSeekTuiGlobalConfig();
      if (!result.success) {
        setError(result.error || i18nService.t('coworkAgentDeepSeekTuiSyncGlobalFailed'));
        return;
      }
      setAgentProviderLists((prev) => ({
        ...prev,
        deepseek_tui: result,
      }));
      setNoticeMessage(i18nService.t('coworkAgentDeepSeekTuiSyncGlobalSuccess'));
      window.dispatchEvent(new CustomEvent('agora-agent-provider-changed', {
        detail: { appType: 'deepseek_tui' },
      }));
    } finally {
      setDeepSeekTuiGlobalSyncing(false);
    }
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'general':
        return (
          <GeneralTab
            language={language}
            setLanguage={setLanguage}
            autoLaunch={autoLaunch}
            setAutoLaunchState={setAutoLaunchState}
            isUpdatingAutoLaunch={isUpdatingAutoLaunch}
            setIsUpdatingAutoLaunch={setIsUpdatingAutoLaunch}
            preventSleep={preventSleep}
            setPreventSleepState={setPreventSleepState}
            isUpdatingPreventSleep={isUpdatingPreventSleep}
            setIsUpdatingPreventSleep={setIsUpdatingPreventSleep}
            useSystemProxy={useSystemProxy}
            setUseSystemProxy={setUseSystemProxy}
            theme={theme}
            setTheme={setTheme}
            themeId={themeId}
            setThemeId={setThemeId}
            setError={setError}
          />
        );

      case 'email':
        return <EmailSkillConfig />;

      case 'coworkAgentEngine':
        return (
          <CoworkAgentEngineTab
            coworkAgentEngine={coworkAgentEngine}
            onChangeCoworkAgentEngine={handleSelectCoworkAgentEngine}
            expandedCoworkAgentEngine={expandedCoworkAgentEngine}
            onToggleExpanded={handleToggleCoworkAgentEngineDetails}
            isSaving={isSaving}
            isCoworkAgentConfigApplying={isCoworkAgentConfigApplying}
            agentEnvironmentSnapshot={agentEnvironmentSnapshot}
            onChangeAgentEnvironmentSnapshot={setAgentEnvironmentSnapshot}
            agentCliInstallingAppType={agentCliInstallingAppType}
            agentCliInstallProgress={agentCliInstallProgress}
            onInstallAgentCli={handleInstallAgentCli}
            openClawEngineStatus={openClawEngineStatus}
            openclawConfigSource={openclawConfigSource}
            onChangeOpenClawConfigSource={setOpenClawConfigSource}
            openclawGlobalSyncing={openclawGlobalSyncing}
            onSyncOpenClawGlobalConfig={() => {
              void handleSyncOpenClawGlobalConfig();
            }}
            onInstallOpenClawEngine={handleInstallOpenClawEngine}
            onRestartOpenClawGateway={handleRestartOpenClawGateway}
            hermesEngineStatus={hermesEngineStatus}
            onInstallHermesEngine={() => {
              void handleInstallHermesEngine();
            }}
            onRestartHermesGateway={handleRestartHermesGateway}
            selectedExternalAgentAppType={selectedExternalAgentAppType}
            selectedAgentConfigSource={selectedAgentConfigSource}
            onSelectAgentConfigSource={setSelectedAgentConfigSource}
            opencodePermissionMode={opencodePermissionMode}
            onSelectOpenCodePermissionMode={setOpenCodePermissionMode}
            claudeCodePermissionMode={claudeCodePermissionMode}
            onSelectClaudeCodePermissionMode={setClaudeCodePermissionMode}
            deepseekTuiPermissionMode={deepseekTuiPermissionMode}
            onSelectDeepSeekTuiPermissionMode={setDeepSeekTuiPermissionMode}
            agentProviderLists={agentProviderLists}
            agentProviderLoadingAppType={agentProviderLoadingAppType}
            agentProviderSwitchingId={agentProviderSwitchingId}
            onRefreshAgentProviders={loadAgentProviders}
            onSelectAgentProvider={(providerId) => {
              void handleSelectAgentProvider(providerId);
            }}
            opencodeGlobalSyncing={opencodeGlobalSyncing}
            onSyncOpenCodeGlobalConfig={() => {
              void handleSyncOpenCodeGlobalConfig();
            }}
            deepseekTuiGlobalSyncing={deepseekTuiGlobalSyncing}
            onSyncDeepSeekTuiGlobalConfig={() => {
              void handleSyncDeepSeekTuiGlobalConfig();
            }}
            effectiveAgentModelSummary={effectiveAgentModelSummary}
            agentConfigImportingAppType={agentConfigImportingAppType}
            onImportLocalAgentConfigToModelSettings={() => {
              void handleImportLocalAgentConfigToModelSettings();
            }}
            configPaths={selectedEngineConfigPaths}
          />
        );

      case 'coworkMemory':
        return (
          <CoworkMemoryTab
            coworkConfig={coworkConfig}
            coworkMemoryStats={coworkMemoryStats}
            coworkMemoryQuery={coworkMemoryQuery}
            setCoworkMemoryQuery={setCoworkMemoryQuery}
            coworkMemoryEntries={coworkMemoryEntries}
            coworkMemoryListLoading={coworkMemoryListLoading}
            handleOpenCoworkMemoryModal={handleOpenCoworkMemoryModal}
            handleEditCoworkMemoryEntry={handleEditCoworkMemoryEntry}
            handleDeleteCoworkMemoryEntry={handleDeleteCoworkMemoryEntry}
          />
        );

      case 'model':
        return (
          <ModelTab
            visibleProviders={visibleProviders}
            providers={providers}
            providerMeta={providerMeta}
            providerLinks={providerLinks}
            activeProvider={activeProvider}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            setProviders={setProviders}
            setError={setError}
            setNoticeMessage={setNoticeMessage}
            minimaxIsOAuthMode={minimaxIsOAuthMode}
            minimaxOAuthPhase={minimaxOAuthPhase}
            copilotAuthStatus={copilotAuthStatus}
            copilotUserCode={copilotUserCode}
            copilotVerificationUri={copilotVerificationUri}
            copilotGithubUser={copilotGithubUser}
            copilotError={copilotError}
            isBaseUrlLocked={isBaseUrlLocked}
            onProviderChange={handleProviderChange}
            onAddCustomProvider={handleAddCustomProvider}
            onDeleteCustomProvider={handleDeleteCustomProvider}
            onToggleProviderEnabled={toggleProviderEnabled}
            onProviderConfigChange={handleProviderConfigChange}
            onSelectMiniMaxOAuth={() => {
              setProviders(prev => ({ ...prev, minimax: { ...prev.minimax, authType: 'oauth' } }));
            }}
            onSelectMiniMaxApiKey={() => {
              setProviders(prev => ({ ...prev, minimax: { ...prev.minimax, authType: 'apikey' } }));
              setMinimaxOAuthPhase({ kind: 'idle' });
            }}
            onMiniMaxSignIn={() => { void handleMiniMaxDeviceLogin(minimaxOAuthRegion); }}
            onCancelMiniMaxLogin={handleCancelMiniMaxLogin}
            onMiniMaxSignOut={handleMiniMaxOAuthLogout}
            onCopilotSignIn={handleCopilotSignIn}
            onCopilotCancelAuth={handleCopilotCancelAuth}
            onCopilotSignOut={handleCopilotSignOut}
            onAddModel={handleAddModel}
            onEditModel={handleEditModel}
            onDeleteModel={handleDeleteModel}
          />
        );

      case 'coworkAgent':
        return (
          <CoworkAgentTab
            coworkConfig={coworkConfig}
            bootstrapIdentity={bootstrapIdentity}
            setBootstrapIdentity={setBootstrapIdentity}
            bootstrapSoul={bootstrapSoul}
            setBootstrapSoul={setBootstrapSoul}
            bootstrapUser={bootstrapUser}
            setBootstrapUser={setBootstrapUser}
          />
        );

      case 'shortcuts':
        return <ShortcutsTab shortcuts={shortcuts} onShortcutChange={handleShortcutChange} />;

      case 'im':
        return <IMSettings />;

      case 'scheduledTasks':
        return (
          <div className="h-full min-h-0">
            <ScheduledTasksView embedded />
          </div>
        );

      case 'mcp':
        return <McpManager />;

      case 'agents':
        return <AgentsView embedded />;

      case 'about':
        return (
          <AboutTab
            appVersion={appVersion}
            enterpriseConfig={enterpriseConfig}
            testMode={testMode}
            setTestMode={setTestMode}
            testModeUnlocked={testModeUnlocked}
            setTestModeUnlocked={setTestModeUnlocked}
            updateCheckStatus={updateCheckStatus}
            handleCheckUpdate={handleCheckUpdate}
            emailCopied={emailCopied}
            handleCopyContactEmail={handleCopyContactEmail}
            handleOpenUserManual={handleOpenUserManual}
            handleOpenUserCommunity={handleOpenUserCommunity}
            handleExportLogs={handleExportLogs}
            isExportingLogs={isExportingLogs}
            aboutContactEmail={ABOUT_CONTACT_EMAIL}
            aboutUserManualUrl={ABOUT_USER_MANUAL_URL}
            aboutUserCommunityUrl={ABOUT_USER_COMMUNITY_URL}
            aboutServiceTermsUrl={ABOUT_SERVICE_TERMS_URL}
            error={error}
            setError={setError}
          />
        );

      default:
        return null;
    }
  };

  const handleCloseSettings = () => {
    if (isSaving) return;
    onClose();
  };

  const isEmbeddedToolTab = activeTab === 'scheduledTasks' || activeTab === 'mcp' || activeTab === 'agents';
  const isFullHeightTab = activeTab === 'scheduledTasks' || activeTab === 'agents';
  const contentClassName = isFullHeightTab
    ? 'p-0 flex-1 overflow-hidden'
    : 'px-6 py-4 flex-1 overflow-y-auto';
  const contentStyle = isFullHeightTab ? undefined : { scrollbarGutter: 'stable' as const };
  const settingsContent = (
    <div
      ref={contentRef}
      className={contentClassName}
      style={contentStyle}
    >
      {renderTabContent()}
    </div>
  );

  return (
    <Modal onClose={handleCloseSettings} overlayClassName="fixed inset-0 z-50 modal-backdrop flex items-center justify-center">
      <div
        className={`relative flex h-[80vh] max-w-[calc(100vw-48px)] rounded-2xl border-border border shadow-modal overflow-hidden modal-content ${
          isEmbeddedToolTab ? 'w-[1040px]' : 'w-[900px]'
        }`}
        onClick={handleSettingsClick}
      >
        {/* Left sidebar */}
        <div className="w-[220px] shrink-0 flex flex-col bg-surface-raised border-r border-border rounded-l-2xl overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-foreground">{i18nService.t('settings')}</h2>
          </div>
          <nav className="flex flex-col gap-0.5 px-3 pb-4">
            {sidebarTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                disabled={isSaving}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeTab === tab.key
                    ? 'bg-primary-muted text-primary'
                    : 'text-secondary hover:text-foreground hover:bg-surface-raised'
                } disabled:cursor-wait disabled:opacity-60`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden bg-background rounded-r-2xl">
          {/* Content header */}
          <div className="flex justify-between items-center px-6 pt-5 pb-3 shrink-0">
            <h3 className="text-lg font-semibold text-foreground">{activeTabLabel}</h3>
            <button
              onClick={handleCloseSettings}
              disabled={isSaving}
              className="text-secondary hover:text-foreground p-1.5 hover:bg-surface-raised rounded-lg transition-colors disabled:cursor-wait disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {noticeMessage && (
            <div className="px-6">
              <ErrorMessage
                message={noticeMessage}
                onClose={() => setNoticeMessage(null)}
              />
            </div>
          )}

          {error && (
            <div className="px-6">
              <ErrorMessage
                message={error}
                onClose={() => setError(null)}
              />
            </div>
          )}

          {isEmbeddedToolTab ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              {settingsContent}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              {settingsContent}

              <div className="flex justify-end space-x-4 p-4 border-border border-t bg-background shrink-0">
                <button
                  type="button"
                  onClick={handleCloseSettings}
                  disabled={isSaving}
                  className="px-4 py-2 text-foreground hover:bg-surface-raised rounded-xl transition-colors text-sm font-medium border border-border active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
                >
                  {i18nService.t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isCoworkAgentConfigApplying
                    ? i18nService.t('coworkAgentConfigApplying')
                    : isSaving ? i18nService.t('saving') : i18nService.t('save')}
                </button>
              </div>
            </form>
          )}

        </div>

        {pendingDeleteProvider && (
          <DeleteProviderModal
            onConfirm={confirmDeleteCustomProvider}
            onCancel={() => setPendingDeleteProvider(null)}
          />
        )}


        {(isAddingModel || isEditingModel) && (
          <ModelEditorModal
            isEditing={isEditingModel}
            newModelId={newModelId}
            setNewModelId={setNewModelId}
            newModelName={newModelName}
            setNewModelName={setNewModelName}
            newModelSupportsImage={newModelSupportsImage}
            setNewModelSupportsImage={setNewModelSupportsImage}
            modelFormError={modelFormError}
            setModelFormError={setModelFormError}
            isOllama={activeProvider === 'ollama'}
            onCancel={handleCancelModelEdit}
            onSave={handleSaveNewModel}
            onKeyDown={handleModelDialogKeyDown}
          />
        )}


          {/* Memory Modal */}
          {showMemoryModal && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
              onClick={resetCoworkMemoryEditor}
            >
              <div
                className="bg-surface border-border border rounded-2xl shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 pb-4 border-b border-border">
                  <h3 className="text-base font-semibold text-foreground">
                    {coworkMemoryEditingId ? i18nService.t('coworkMemoryCrudUpdate') : i18nService.t('coworkMemoryCrudCreate')}
                  </h3>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {coworkMemoryEditingId && (
                    <div className="rounded-lg border px-2 py-1 text-xs border-border text-secondary">
                      {i18nService.t('coworkMemoryEditingTag')}
                    </div>
                  )}
                  <textarea
                    value={coworkMemoryDraftText}
                    onChange={(event) => setCoworkMemoryDraftText(event.target.value)}
                    placeholder={i18nService.t('coworkMemoryCrudTextPlaceholder')}
                    autoFocus
                    className="min-h-[200px] w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                <div className="flex justify-end space-x-2 px-5 pb-5">
                  <button
                    type="button"
                    onClick={resetCoworkMemoryEditor}
                    className="px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised rounded-xl border border-border transition-colors"
                  >
                    {i18nService.t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleSaveCoworkMemoryEntry(); }}
                    disabled={!coworkMemoryDraftText.trim() || coworkMemoryListLoading}
                    className="px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                  >
                    {coworkMemoryEditingId ? i18nService.t('save') : i18nService.t('coworkMemoryCrudCreate')}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </Modal>
  );
};

export default Settings; 
