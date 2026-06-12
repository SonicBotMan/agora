/**
 * useCoworkAgentEngine — manages agent engine selection, config sources,
 * engine status, CLI installation, provider management, and global sync.
 *
 * Extracted from Settings.tsx to reduce its size and isolate agent-engine
 * concerns.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  ClaudeCodePermissionMode as ClaudeCodePermissionModeValue,
  CoworkAgentEngine as CoworkAgentEngineValue,
  DeepSeekTuiPermissionMode as DeepSeekTuiPermissionModeValue,
  ExternalAgentConfigSource as ExternalAgentConfigSourceValue,
  OpenCodePermissionMode as OpenCodePermissionModeValue,
} from '../../../../shared/cowork/constants';
import { getProviderDisplayName } from '../../../config';
import { configService } from '../../../services/config';
import { coworkService } from '../../../services/cowork';
import { i18nService } from '../../../services/i18n';
import { RootState } from '../../../store';
import type {
  ClaudeCodePermissionMode,
  CoworkAgentEngine,
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
} from '../../../types/cowork';
import type { ProviderConfig, ProvidersConfig,ProviderType } from '../providerConfigUtils';
import { getEffectiveApiFormat } from '../providerConfigUtils';
import { providerKeys } from '../providerConfigUtils';

// ── Hook parameter interface ────────────────────────────────────────────────

export interface UseCoworkAgentEngineArgs {
  isSaving: boolean;
  activeTab: string;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setNoticeMessage: React.Dispatch<React.SetStateAction<string | null>>;
  /** Called when importing agent config changes the active provider */
  setActiveProvider: React.Dispatch<React.SetStateAction<ProviderType>>;
  setProviders: React.Dispatch<React.SetStateAction<ProvidersConfig>>;
  /** Provider state for currentModelSummary computation */
  activeProvider: ProviderType;
  providers: ProvidersConfig;
}

export interface UseCoworkAgentEngineResult {
  // State
  coworkAgentEngine: CoworkAgentEngine;
  expandedCoworkAgentEngine: CoworkAgentEngine | null;
  openClawEngineStatus: OpenClawEngineStatus | null;
  hermesEngineStatus: HermesEngineStatus | null;
  agentEnvironmentSnapshot: ExternalAgentEnvironmentSnapshot | null;
  openclawConfigSource: ExternalAgentConfigSource;
  claudeCodeConfigSource: ExternalAgentConfigSource;
  claudeCodePermissionMode: ClaudeCodePermissionMode;
  codexConfigSource: ExternalAgentConfigSource;
  hermesConfigSource: ExternalAgentConfigSource;
  opencodeConfigSource: ExternalAgentConfigSource;
  opencodePermissionMode: OpenCodePermissionMode;
  deepseekTuiConfigSource: ExternalAgentConfigSource;
  deepseekTuiPermissionMode: DeepSeekTuiPermissionMode;
  agentConfigImportingAppType: ExternalAgentProviderAppType | null;
  openclawGlobalSyncing: boolean;
  opencodeGlobalSyncing: boolean;
  deepseekTuiGlobalSyncing: boolean;
  agentCliInstallingAppType: ExternalAgentProviderAppType | null;
  agentCliInstallProgress: Record<ExternalAgentProviderAppType, string>;
  agentProviderLists: Partial<Record<ExternalAgentProviderAppType, ExternalAgentProviderListResult>>;
  agentProviderLoadingAppType: ExternalAgentProviderAppType | null;
  agentProviderSwitchingId: string | null;

  // Derived
  selectedExternalAgentAppType: ExternalAgentProviderAppType | null;
  selectedAgentConfigSource: ExternalAgentConfigSource | null;
  effectiveAgentModelSummary: ReturnType<typeof useMemo<{ providerKey: string; providerName: string; modelId: string; apiFormat?: string; baseUrl: string }>>;
  selectedEngineConfigPaths: string[];
  hasCoworkConfigChanges: boolean;
  hasCoworkAgentEngineApplyChanges: boolean;
  isCoworkAgentConfigApplying: boolean;

  // Handlers
  handleSelectCoworkAgentEngine: (engine: CoworkAgentEngine) => void;
  handleToggleCoworkAgentEngineDetails: (engine: CoworkAgentEngine) => void;
  setSelectedAgentConfigSource: (source: ExternalAgentConfigSource) => void;
  setOpenClawConfigSource: React.Dispatch<React.SetStateAction<ExternalAgentConfigSource>>;
  setClaudeCodePermissionMode: React.Dispatch<React.SetStateAction<ClaudeCodePermissionMode>>;
  setOpenCodePermissionMode: React.Dispatch<React.SetStateAction<OpenCodePermissionMode>>;
  setDeepSeekTuiPermissionMode: React.Dispatch<React.SetStateAction<DeepSeekTuiPermissionMode>>;
  setAgentEnvironmentSnapshot: React.Dispatch<React.SetStateAction<ExternalAgentEnvironmentSnapshot | null>>;
  loadAgentProviders: (appType: ExternalAgentProviderAppType) => Promise<ExternalAgentProviderListResult | undefined>;
  handleSelectAgentProvider: (providerId: string) => Promise<void>;
  handleInstallAgentCli: (appType: ExternalAgentProviderAppType) => Promise<void>;
  handleInstallHermesEngine: () => Promise<void>;
  handleInstallOpenClawEngine: () => void;
  handleRestartOpenClawGateway: () => void;
  handleRestartHermesGateway: () => void;
  handleImportLocalAgentConfigToModelSettings: () => Promise<void>;
  handleSyncOpenClawGlobalConfig: () => Promise<void>;
  handleSyncOpenCodeGlobalConfig: () => Promise<void>;
  handleSyncDeepSeekTuiGlobalConfig: () => Promise<void>;
}

export function useCoworkAgentEngine(args: UseCoworkAgentEngineArgs): UseCoworkAgentEngineResult {
  const {
    isSaving,
    activeTab,
    setError,
    setNoticeMessage,
    setActiveProvider,
    setProviders,
    activeProvider,
    providers,
  } = args;

  const coworkConfig = useSelector((state: RootState) => state.cowork.config);

  // ── Agent engine selection state ────────────────────────────────────────
  const [coworkAgentEngine, setCoworkAgentEngine] = useState<CoworkAgentEngine>(coworkConfig.agentEngine || CoworkAgentEngineValue.OpenCode);
  const [expandedCoworkAgentEngine, setExpandedCoworkAgentEngine] = useState<CoworkAgentEngine | null>(null);

  // ── Engine status & config source state ─────────────────────────────────
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

  // ── Derived values ──────────────────────────────────────────────────────

  const selectedExternalAgentAppType = useMemo<ExternalAgentProviderAppType | null>(() => {
    if (coworkAgentEngine === CoworkAgentEngineValue.ClaudeCode) return 'claude';
    if (coworkAgentEngine === CoworkAgentEngineValue.Codex) return 'codex';
    if (coworkAgentEngine === CoworkAgentEngineValue.Hermes) return 'hermes';
    if (coworkAgentEngine === CoworkAgentEngineValue.OpenCode) return 'opencode';
    if (coworkAgentEngine === CoworkAgentEngineValue.DeepSeekTui) return 'deepseek_tui';
    return null;
  }, [coworkAgentEngine]);

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
    opencodeConfigSource,
    selectedExternalAgentAppType,
  ]);

  const setSelectedAgentConfigSource = useCallback((source: ExternalAgentConfigSource) => {
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
  }, [isSaving, selectedExternalAgentAppType]);

  const selectedAgentProviderList = selectedExternalAgentAppType
    ? agentProviderLists[selectedExternalAgentAppType] ?? null
    : null;
  const selectedAgentProvider = useMemo<ExternalAgentProvider | null>(() => {
    const provList = selectedAgentProviderList?.providers ?? [];
    return provList.find((provider) => provider.id === selectedAgentProviderList?.currentProviderId)
      ?? provList.find((provider) => provider.isCurrent)
      ?? provList[0]
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
;

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

  // ── Effects ─────────────────────────────────────────────────────────────

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
  ]);

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

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSelectCoworkAgentEngine = useCallback((engine: CoworkAgentEngine) => {
    if (isSaving) return;
    setCoworkAgentEngine(engine);
    setExpandedCoworkAgentEngine(engine);
  }, [isSaving]);

  const handleToggleCoworkAgentEngineDetails = useCallback((engine: CoworkAgentEngine) => {
    if (isSaving) return;
    setExpandedCoworkAgentEngine((current) => (
      current === engine ? null : engine
    ));
  }, [isSaving]);

  const refreshAgentEnvironmentSnapshot = async () => {
    const snapshot = await coworkService.getAgentEngineSnapshot();
    setAgentEnvironmentSnapshot(snapshot);
  };

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

  return {
    coworkAgentEngine,
    expandedCoworkAgentEngine,
    openClawEngineStatus,
    hermesEngineStatus,
    agentEnvironmentSnapshot,
    openclawConfigSource,
    claudeCodeConfigSource,
    claudeCodePermissionMode,
    codexConfigSource,
    hermesConfigSource,
    opencodeConfigSource,
    opencodePermissionMode,
    deepseekTuiConfigSource,
    deepseekTuiPermissionMode,
    agentConfigImportingAppType,
    openclawGlobalSyncing,
    opencodeGlobalSyncing,
    deepseekTuiGlobalSyncing,
    agentCliInstallingAppType,
    agentCliInstallProgress,
    agentProviderLists,
    agentProviderLoadingAppType,
    agentProviderSwitchingId,
    selectedExternalAgentAppType,
    selectedAgentConfigSource,
    effectiveAgentModelSummary,
    selectedEngineConfigPaths,
    hasCoworkConfigChanges,
    hasCoworkAgentEngineApplyChanges,
    isCoworkAgentConfigApplying,
    handleSelectCoworkAgentEngine,
    handleToggleCoworkAgentEngineDetails,
    setSelectedAgentConfigSource,
    setOpenClawConfigSource,
    setClaudeCodePermissionMode,
    setOpenCodePermissionMode,
    setDeepSeekTuiPermissionMode,
    setAgentEnvironmentSnapshot,
    loadAgentProviders,
    handleSelectAgentProvider,
    handleInstallAgentCli,
    handleInstallHermesEngine,
    handleInstallOpenClawEngine,
    handleRestartOpenClawGateway,
    handleRestartHermesGateway,
    handleImportLocalAgentConfigToModelSettings,
    handleSyncOpenClawGlobalConfig,
    handleSyncOpenCodeGlobalConfig,
    handleSyncDeepSeekTuiGlobalConfig,
  };
}
