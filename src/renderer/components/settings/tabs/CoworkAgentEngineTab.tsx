import {
  CoworkAgentEngine as CoworkAgentEngineValue,
  ExternalAgentConfigSource as ExternalAgentConfigSourceValue,
} from '@shared/cowork/constants';
import React, { useMemo } from 'react';

import { i18nService } from '../../../services/i18n';
import type {
  ClaudeCodePermissionMode,
  CoworkAgentEngine,
  DeepSeekTuiPermissionMode,
  ExternalAgentConfigSource,
  ExternalAgentEnvironmentSnapshot,
  ExternalAgentProvider,
  ExternalAgentProviderAppType,
  ExternalAgentProviderListResult,
  HermesEngineStatus,
  OpenClawEngineStatus,
  OpenCodePermissionMode,
} from '../../../types/cowork';
import AgentEnvironmentSetup from '../../cowork/AgentEnvironmentSetup';
import {
  AgentConfigSourceSection,
  type EffectiveAgentModelSummary,
} from './AgentConfigSourceSection';

const COWORK_AGENT_ENGINE_OPTIONS: Array<{
  value: CoworkAgentEngine;
  labelKey: string;
  hintKey: string;
}> = [
  {
    value: CoworkAgentEngineValue.OpenClaw,
    labelKey: 'coworkAgentEngineOpenClaw',
    hintKey: 'coworkAgentEngineOpenClawHint',
  },
  {
    value: CoworkAgentEngineValue.Hermes,
    labelKey: 'coworkAgentEngineHermes',
    hintKey: 'coworkAgentEngineHermesHint',
  },
  {
    value: CoworkAgentEngineValue.ClaudeCode,
    labelKey: 'coworkAgentEngineClaudeCode',
    hintKey: 'coworkAgentEngineClaudeCodeHint',
  },
  {
    value: CoworkAgentEngineValue.Codex,
    labelKey: 'coworkAgentEngineCodex',
    hintKey: 'coworkAgentEngineCodexHint',
  },
  {
    value: CoworkAgentEngineValue.OpenCode,
    labelKey: 'coworkAgentEngineOpenCode',
    hintKey: 'coworkAgentEngineOpenCodeHint',
  },
  {
    value: CoworkAgentEngineValue.DeepSeekTui,
    labelKey: 'coworkAgentEngineDeepSeekTui',
    hintKey: 'coworkAgentEngineDeepSeekTuiHint',
  },
];

export interface CoworkAgentEngineTabProps {
  // engine selection state
  coworkAgentEngine: CoworkAgentEngine;
  onChangeCoworkAgentEngine: (engine: CoworkAgentEngine) => void;
  expandedCoworkAgentEngine: CoworkAgentEngine | null;
  onToggleExpanded: (engine: CoworkAgentEngine) => void;
  isSaving: boolean;
  isCoworkAgentConfigApplying: boolean;

  // environment snapshot
  agentEnvironmentSnapshot: ExternalAgentEnvironmentSnapshot | null;
  onChangeAgentEnvironmentSnapshot: (snapshot: ExternalAgentEnvironmentSnapshot | null) => void;

  // cli install state
  agentCliInstallingAppType: ExternalAgentProviderAppType | null;
  agentCliInstallProgress: Record<ExternalAgentProviderAppType, string>;
  onInstallAgentCli: (appType: ExternalAgentProviderAppType) => void;

  // openclaw state
  openClawEngineStatus: OpenClawEngineStatus | null;
  openclawConfigSource: ExternalAgentConfigSource;
  onChangeOpenClawConfigSource: (source: ExternalAgentConfigSource) => void;
  openclawGlobalSyncing: boolean;
  onSyncOpenClawGlobalConfig: () => void;
  onInstallOpenClawEngine: () => void;
  onRestartOpenClawGateway: () => void;

  // hermes state
  hermesEngineStatus: HermesEngineStatus | null;
  onInstallHermesEngine: () => void;
  onRestartHermesGateway: () => void;

  // config source state per engine
  selectedExternalAgentAppType: ExternalAgentProviderAppType | null;
  selectedAgentConfigSource: ExternalAgentConfigSource | null;
  onSelectAgentConfigSource: (source: ExternalAgentConfigSource) => void;

  // permission modes
  opencodePermissionMode: OpenCodePermissionMode;
  onSelectOpenCodePermissionMode: (mode: OpenCodePermissionMode) => void;
  claudeCodePermissionMode: ClaudeCodePermissionMode;
  onSelectClaudeCodePermissionMode: (mode: ClaudeCodePermissionMode) => void;
  deepseekTuiPermissionMode: DeepSeekTuiPermissionMode;
  onSelectDeepSeekTuiPermissionMode: (mode: DeepSeekTuiPermissionMode) => void;

  // agent provider state
  agentProviderLists: Partial<Record<ExternalAgentProviderAppType, ExternalAgentProviderListResult>>;
  agentProviderLoadingAppType: ExternalAgentProviderAppType | null;
  agentProviderSwitchingId: string | null;
  onRefreshAgentProviders: (appType: ExternalAgentProviderAppType) => void;
  onSelectAgentProvider: (providerId: string) => void;
  opencodeGlobalSyncing: boolean;
  onSyncOpenCodeGlobalConfig: () => void;
  deepseekTuiGlobalSyncing: boolean;
  onSyncDeepSeekTuiGlobalConfig: () => void;

  // effective summary
  effectiveAgentModelSummary: EffectiveAgentModelSummary;
  agentConfigImportingAppType: ExternalAgentProviderAppType | null;
  onImportLocalAgentConfigToModelSettings: () => void;
  configPaths: string[];
}

export const CoworkAgentEngineTab: React.FC<CoworkAgentEngineTabProps> = ({
  coworkAgentEngine,
  onChangeCoworkAgentEngine,
  expandedCoworkAgentEngine,
  onToggleExpanded,
  isSaving,
  isCoworkAgentConfigApplying,
  agentEnvironmentSnapshot,
  onChangeAgentEnvironmentSnapshot,
  agentCliInstallingAppType,
  agentCliInstallProgress,
  onInstallAgentCli,
  openClawEngineStatus,
  openclawConfigSource,
  onChangeOpenClawConfigSource,
  openclawGlobalSyncing,
  onSyncOpenClawGlobalConfig,
  onInstallOpenClawEngine,
  onRestartOpenClawGateway,
  hermesEngineStatus,
  onInstallHermesEngine,
  onRestartHermesGateway,
  selectedExternalAgentAppType,
  selectedAgentConfigSource,
  onSelectAgentConfigSource,
  opencodePermissionMode,
  onSelectOpenCodePermissionMode,
  claudeCodePermissionMode,
  onSelectClaudeCodePermissionMode,
  deepseekTuiPermissionMode,
  onSelectDeepSeekTuiPermissionMode,
  agentProviderLists,
  agentProviderLoadingAppType,
  agentProviderSwitchingId,
  onRefreshAgentProviders,
  onSelectAgentProvider,
  opencodeGlobalSyncing,
  onSyncOpenCodeGlobalConfig,
  deepseekTuiGlobalSyncing,
  onSyncDeepSeekTuiGlobalConfig,
  effectiveAgentModelSummary,
  agentConfigImportingAppType,
  onImportLocalAgentConfigToModelSettings,
  configPaths,
}) => {
  const openClawProgressPercent = useMemo(() => {
    if (typeof openClawEngineStatus?.progressPercent !== 'number' || !Number.isFinite(openClawEngineStatus.progressPercent)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(openClawEngineStatus.progressPercent)));
  }, [openClawEngineStatus]);

  const hermesProgressPercent = useMemo(() => {
    if (typeof hermesEngineStatus?.progressPercent !== 'number' || !Number.isFinite(hermesEngineStatus.progressPercent)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(hermesEngineStatus.progressPercent)));
  }, [hermesEngineStatus]);

  const getCliEngineStatus = (engine: CoworkAgentEngine) => {
    return agentEnvironmentSnapshot?.engines.find((item) => item.engine === engine) ?? null;
  };

  const resolveOpenClawStatusText = (status: OpenClawEngineStatus | null): string => {
    if (!status) {
      return i18nService.t('coworkOpenClawNotInstalledNotice');
    }
    if ((status.phase === 'installing' || status.phase === 'error') && status.message?.trim()) {
      return status.message.trim();
    }
    switch (status.phase) {
      case 'not_installed':
        return i18nService.t('coworkOpenClawNotInstalledNotice');
      case 'installing':
        return i18nService.t('coworkOpenClawInstalling');
      case 'ready':
        return i18nService.t('coworkOpenClawReadyNotice');
      case 'starting':
        return i18nService.t('coworkOpenClawStarting');
      case 'error':
        return i18nService.t('coworkOpenClawError');
      case 'running':
      default:
        return i18nService.t('coworkOpenClawRunning');
    }
  };

  const resolveHermesStatusText = (status: HermesEngineStatus | null): string => {
    if (!status) {
      return i18nService.t('coworkHermesNotInstalledNotice');
    }
    if (status.message?.trim()) {
      return status.message.trim();
    }
    switch (status.phase) {
      case 'not_installed':
        return i18nService.t('coworkHermesNotInstalledNotice');
      case 'installing':
        return i18nService.t('coworkHermesInstalling');
      case 'ready':
        return i18nService.t('coworkHermesReadyNotice');
      case 'starting':
        return i18nService.t('coworkHermesStarting');
      case 'error':
        return i18nService.t('coworkHermesError');
      case 'running':
      default:
        return i18nService.t('coworkHermesRunning');
    }
  };

  const renderCoworkAgentApplyProgress = () => {
    if (!isCoworkAgentConfigApplying) return null;
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-secondary">
          <span>{i18nService.t('coworkAgentConfigApplying')}</span>
          <span className="text-[11px] text-primary">
            {i18nService.t('coworkAgentConfigApplyingHint')}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    );
  };

  const renderAgentEngineMeta = (engine: CoworkAgentEngine) => {
    const cliStatus = getCliEngineStatus(engine);
    if (!cliStatus) return null;
    const isMacOS = window.electron?.platform === 'darwin';
    const isInstalling = agentCliInstallingAppType === cliStatus.appType;
    const installProgress = agentCliInstallProgress[cliStatus.appType];

    const rows = [
      {
        label: i18nService.t('coworkAgentEngineCommandPath'),
        value: cliStatus.path || cliStatus.error || '',
      },
      {
        label: i18nService.t('coworkAgentEngineVersion'),
        value: cliStatus.version || '',
      },
      {
        label: i18nService.t('coworkAgentEngineConfigPath'),
        value: cliStatus.config.primaryConfigPath,
      },
    ].filter((row) => row.value);

    return (
      <div className="mt-3 space-y-1.5 rounded-lg bg-surface-raised/60 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${cliStatus.found ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className={cliStatus.found ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
              {i18nService.t(cliStatus.found ? 'coworkAgentEngineCliInstalled' : 'coworkAgentEngineCliMissing')}
            </span>
          </span>
          {!cliStatus.found && (
            isMacOS ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onInstallAgentCli(cliStatus.appType);
                }}
                disabled={Boolean(agentCliInstallingAppType)}
                className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-background disabled:opacity-50"
              >
                {i18nService.t(isInstalling ? 'coworkAgentEngineInstallCliInstalling' : 'coworkAgentEngineInstallCli')}
              </button>
            ) : (
              <span className="text-[11px] text-secondary">
                {i18nService.t('coworkAgentEngineInstallCliUnsupported')}
              </span>
            )
          )}
        </div>
        {!cliStatus.found && installProgress && (
          <div className="truncate text-[11px] leading-5 text-secondary" title={installProgress}>
            {installProgress}
          </div>
        )}
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
            <span className="text-secondary">{row.label}</span>
            <span className="truncate font-mono text-foreground/80" title={row.value}>{row.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderOpenClawAgentEngineDetails = () => {
    const cliStatus = agentEnvironmentSnapshot?.engines.find((item) => item.appType === 'openclaw');
    const installProgress = agentCliInstallProgress.openclaw;
    const isInstalling = agentCliInstallingAppType === 'openclaw' || openClawEngineStatus?.phase === 'installing';
    const statusRows = [
      { label: i18nService.t('coworkAgentEngineCommandPath'), value: openClawEngineStatus?.binaryPath || cliStatus?.path || '-' },
      { label: i18nService.t('coworkAgentEngineVersion'), value: openClawEngineStatus?.version || cliStatus?.version || '-' },
      { label: i18nService.t('coworkAgentEngineConfigPath'), value: openClawEngineStatus?.configPath || cliStatus?.config.primaryConfigPath || '-' },
      { label: i18nService.t('coworkAgentOpenClawGateway'), value: openClawEngineStatus?.gatewayUrl || (openClawEngineStatus?.gatewayPort ? `loopback:${openClawEngineStatus.gatewayPort}` : '-') },
      { label: i18nService.t('coworkAgentOpenClawGatewayMode'), value: openClawEngineStatus?.gatewayMode ? i18nService.t(openClawEngineStatus.gatewayMode === 'attached' ? 'coworkAgentOpenClawGatewayAttached' : 'coworkAgentOpenClawGatewayManaged') : '-' },
      { label: i18nService.t('coworkAgentOpenClawCurrentModel'), value: openClawEngineStatus?.currentModel || cliStatus?.config.currentProviderName || '-' },
      { label: i18nService.t('coworkAgentOpenClawFeishuStatus'), value: openClawEngineStatus?.feishuRunning ? i18nService.t('coworkAgentOpenClawFeishuRunning') : openClawEngineStatus?.feishuConfigured ? i18nService.t('coworkAgentOpenClawFeishuConfigured') : '-' },
    ];
    const sourceOptions = [
      {
        value: ExternalAgentConfigSourceValue.LocalCli,
        labelKey: 'coworkAgentConfigSourceLocalCli',
        hintKey: 'coworkAgentOpenClawLocalCliHint',
      },
      {
        value: ExternalAgentConfigSourceValue.AgoraModel,
        labelKey: 'coworkAgentConfigSourceAgoraModel',
        hintKey: 'coworkAgentOpenClawAgoraModelHint',
      },
    ];

    return (
      <div className="mt-4 space-y-4">
        {renderAgentEngineMeta(CoworkAgentEngineValue.OpenClaw)}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="text-sm font-medium text-foreground">
            {i18nService.t('coworkAgentConfigSourceTitle')}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sourceOptions.map((option) => {
              const checked = openclawConfigSource === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex gap-3 rounded-xl border px-3 py-3 transition-colors ${isSaving ? 'cursor-wait opacity-70' : 'cursor-pointer'} ${checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-raised'}`}
                >
                  <input
                    type="radio"
                    name="openclaw-config-source"
                    checked={checked}
                    disabled={isSaving}
                    onChange={() => onChangeOpenClawConfigSource(option.value)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {i18nService.t(option.labelKey)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-secondary">
                      {i18nService.t(option.hintKey)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className={`rounded-xl border px-4 py-3 text-sm ${openClawEngineStatus?.phase === 'error'
          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
          : 'border-border bg-surface-raised/60 text-foreground'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              {resolveOpenClawStatusText(openClawEngineStatus)}
              {openClawProgressPercent !== null && (
                <span className="ml-2 text-xs opacity-80">{openClawProgressPercent}%</span>
              )}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (openClawEngineStatus?.phase === 'not_installed') {
                  onInstallOpenClawEngine();
                } else {
                  onRestartOpenClawGateway();
                }
              }}
              disabled={isInstalling || openClawEngineStatus?.phase === 'starting'}
              className="shrink-0 rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium hover:bg-black/5 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/10"
            >
              {i18nService.t(openClawEngineStatus?.phase === 'not_installed'
                ? 'coworkOpenClawInstallCli'
                : openClawEngineStatus?.gatewayMode === 'attached'
                  ? 'coworkOpenClawReconnectGateway'
                  : 'coworkOpenClawRestartGateway')}
            </button>
          </div>
          {installProgress && (
            <div className="mt-2 truncate text-[11px] leading-5 text-secondary" title={installProgress}>
              {installProgress}
            </div>
          )}
          {openClawProgressPercent !== null && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${openClawProgressPercent}%` }}
              />
            </div>
          )}
          <div className="mt-3 space-y-1">
            {statusRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                <span className="text-secondary">{row.label}</span>
                <span className="truncate font-mono text-foreground/80" title={row.value}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border px-3 py-3 text-xs leading-5 text-secondary">
          {i18nService.t('coworkAgentOpenClawFeishuLocalHint')}
        </div>

        {openclawConfigSource === ExternalAgentConfigSourceValue.AgoraModel && (
          <div className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-5 text-secondary">
              {i18nService.t('coworkAgentOpenClawSyncGlobalHint')}
            </div>
            <button
              type="button"
              onClick={onSyncOpenClawGlobalConfig}
              disabled={openclawGlobalSyncing}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised disabled:cursor-wait disabled:opacity-50"
            >
              {i18nService.t(openclawGlobalSyncing
                ? 'coworkAgentOpenClawSyncGlobalSyncing'
                : 'coworkAgentOpenClawSyncGlobal')}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderHermesAgentEngineDetails = () => (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="text-xs text-secondary">
        {i18nService.t('coworkHermesInstallHint')}
      </div>
      <div className={`rounded-xl border px-4 py-3 text-sm ${hermesEngineStatus?.phase === 'error'
        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            {resolveHermesStatusText(hermesEngineStatus)}
            {hermesProgressPercent !== null && (
              <span className="ml-2 text-xs opacity-80">{hermesProgressPercent}%</span>
            )}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (hermesEngineStatus?.phase === 'not_installed') {
                onInstallHermesEngine();
              } else {
                onRestartHermesGateway();
              }
            }}
            disabled={
              agentCliInstallingAppType === 'hermes'
              || hermesEngineStatus?.phase === 'installing'
              || hermesEngineStatus?.phase === 'starting'
            }
            className="shrink-0 rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium hover:bg-black/5 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/10"
          >
            {i18nService.t(
              agentCliInstallingAppType === 'hermes'
                ? 'coworkAgentEngineInstallCliInstalling'
                : hermesEngineStatus?.phase === 'not_installed'
                  ? 'coworkAgentEngineInstallCli'
                  : 'coworkHermesRestartGateway',
            )}
          </button>
        </div>
        {hermesProgressPercent !== null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${hermesProgressPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderSelectedAgentEngineDetails = (engine: CoworkAgentEngine) => {
    if (
      engine === CoworkAgentEngineValue.ClaudeCode
      || engine === CoworkAgentEngineValue.Codex
      || engine === CoworkAgentEngineValue.Hermes
      || engine === CoworkAgentEngineValue.OpenCode
      || engine === CoworkAgentEngineValue.DeepSeekTui
    ) {
      return (
        <div className="mt-4 space-y-4">
          {renderAgentEngineMeta(engine)}
          {engine === CoworkAgentEngineValue.Hermes && renderHermesAgentEngineDetails()}
          <AgentConfigSourceSection
            selectedExternalAgentAppType={selectedExternalAgentAppType}
            selectedAgentConfigSource={selectedAgentConfigSource}
            isSaving={isSaving}
            applyProgress={renderCoworkAgentApplyProgress()}
            onSelectAgentConfigSource={onSelectAgentConfigSource}
            opencodePermissionMode={opencodePermissionMode}
            onSelectOpenCodePermissionMode={onSelectOpenCodePermissionMode}
            claudeCodePermissionMode={claudeCodePermissionMode}
            onSelectClaudeCodePermissionMode={onSelectClaudeCodePermissionMode}
            deepseekTuiPermissionMode={deepseekTuiPermissionMode}
            onSelectDeepSeekTuiPermissionMode={onSelectDeepSeekTuiPermissionMode}
            selectedAgentProviderList={selectedExternalAgentAppType
              ? agentProviderLists[selectedExternalAgentAppType] ?? null
              : null}
            selectedAgentProvider={(() => {
              const list = selectedExternalAgentAppType
                ? agentProviderLists[selectedExternalAgentAppType] ?? null
                : null;
              const providers: ExternalAgentProvider[] = list?.providers ?? [];
              return providers.find((provider) => provider.id === list?.currentProviderId)
                ?? providers.find((provider) => provider.isCurrent)
                ?? providers[0]
                ?? null;
            })()}
            agentProviderLoadingAppType={agentProviderLoadingAppType}
            agentProviderSwitchingId={agentProviderSwitchingId}
            onRefreshAgentProviders={() => {
              if (selectedExternalAgentAppType) {
                onRefreshAgentProviders(selectedExternalAgentAppType);
              }
            }}
            onSelectAgentProvider={onSelectAgentProvider}
            opencodeGlobalSyncing={opencodeGlobalSyncing}
            onSyncOpenCodeGlobalConfig={onSyncOpenCodeGlobalConfig}
            deepseekTuiGlobalSyncing={deepseekTuiGlobalSyncing}
            onSyncDeepSeekTuiGlobalConfig={onSyncDeepSeekTuiGlobalConfig}
            effectiveAgentModelSummary={effectiveAgentModelSummary}
            isImporting={agentConfigImportingAppType === selectedExternalAgentAppType}
            onImportLocalAgentConfigToModelSettings={onImportLocalAgentConfigToModelSettings}
            configPaths={configPaths}
          />
        </div>
      );
    }
    if (engine === CoworkAgentEngineValue.OpenClaw) {
      return renderOpenClawAgentEngineDetails();
    }
    return (
      <div className="mt-4 rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-xs leading-5 text-secondary">
        {i18nService.t('coworkAgentEngineNoExtraConfig')}
      </div>
    );
  };

  const renderAgentEngineOption = (option: typeof COWORK_AGENT_ENGINE_OPTIONS[number]) => {
    const checked = coworkAgentEngine === option.value;
    const expanded = checked && expandedCoworkAgentEngine === option.value;
    return (
      <div
        key={option.value}
        role="button"
        tabIndex={0}
        onClick={() => onChangeCoworkAgentEngine(option.value)}
        aria-disabled={isSaving}
        onKeyDown={(event) => {
          if (isSaving) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onChangeCoworkAgentEngine(option.value);
          }
        }}
        className={`rounded-xl border px-3 py-3 text-sm transition-colors ${isSaving ? 'cursor-wait opacity-70' : 'cursor-pointer'} ${checked
          ? 'border-primary/60 bg-primary/5'
          : `border-border ${isSaving ? '' : 'hover:bg-surface-raised'}`}`}
      >
        <div className="flex items-start gap-3">
          <input
            type="radio"
            name="cowork-agent-engine"
            checked={checked}
            disabled={isSaving}
            onChange={() => onChangeCoworkAgentEngine(option.value)}
            onClick={(event) => event.stopPropagation()}
            className="mt-1"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">
              {i18nService.t(option.labelKey)}
            </span>
            <span className="mt-1 block text-xs leading-5 text-secondary">
              {i18nService.t(option.hintKey)}
            </span>
          </span>
          {checked && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleExpanded(option.value);
              }}
              disabled={isSaving}
              className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-background disabled:cursor-wait disabled:opacity-50"
            >
              {i18nService.t(expanded ? 'coworkAgentEngineCollapseConfig' : 'coworkAgentEngineExpandConfig')}
            </button>
          )}
        </div>
        {expanded && renderSelectedAgentEngineDetails(option.value)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AgentEnvironmentSetup
        selectedEngine={coworkAgentEngine}
        onEngineChange={onChangeCoworkAgentEngine}
        onSnapshotChange={onChangeAgentEnvironmentSnapshot}
        compact
      />
      {expandedCoworkAgentEngine !== coworkAgentEngine && renderCoworkAgentApplyProgress()}
      <div className="space-y-3">
        {COWORK_AGENT_ENGINE_OPTIONS.map(renderAgentEngineOption)}
      </div>
    </div>
  );
};
