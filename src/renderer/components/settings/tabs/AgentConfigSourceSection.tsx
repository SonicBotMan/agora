import {
  ClaudeCodePermissionMode as ClaudeCodePermissionModeValue,
  DeepSeekTuiPermissionMode as DeepSeekTuiPermissionModeValue,
  ExternalAgentConfigSource as ExternalAgentConfigSourceValue,
  OpenCodePermissionMode as OpenCodePermissionModeValue,
} from '@shared/cowork/constants';
import React from 'react';

import { i18nService } from '../../../services/i18n';
import type {
  ClaudeCodePermissionMode,
  DeepSeekTuiPermissionMode,
  ExternalAgentConfigSource,
  ExternalAgentProvider,
  ExternalAgentProviderAppType,
  ExternalAgentProviderListResult,
  OpenCodePermissionMode,
} from '../../../types/cowork';

export interface EffectiveAgentModelSummary {
  providerName: string;
  modelId: string;
  apiFormat?: string;
  baseUrl: string;
}

export interface AgentConfigSourceSectionProps {
  selectedExternalAgentAppType: ExternalAgentProviderAppType | null;
  selectedAgentConfigSource: ExternalAgentConfigSource | null;
  isSaving: boolean;
  applyProgress: React.ReactNode;
  onSelectAgentConfigSource: (source: ExternalAgentConfigSource) => void;
  opencodePermissionMode: OpenCodePermissionMode;
  onSelectOpenCodePermissionMode: (mode: OpenCodePermissionMode) => void;
  claudeCodePermissionMode: ClaudeCodePermissionMode;
  onSelectClaudeCodePermissionMode: (mode: ClaudeCodePermissionMode) => void;
  deepseekTuiPermissionMode: DeepSeekTuiPermissionMode;
  onSelectDeepSeekTuiPermissionMode: (mode: DeepSeekTuiPermissionMode) => void;
  selectedAgentProviderList: ExternalAgentProviderListResult | null;
  selectedAgentProvider: ExternalAgentProvider | null;
  agentProviderLoadingAppType: ExternalAgentProviderAppType | null;
  agentProviderSwitchingId: string | null;
  onRefreshAgentProviders: () => void;
  onSelectAgentProvider: (providerId: string) => void;
  opencodeGlobalSyncing: boolean;
  onSyncOpenCodeGlobalConfig: () => void;
  deepseekTuiGlobalSyncing: boolean;
  onSyncDeepSeekTuiGlobalConfig: () => void;
  effectiveAgentModelSummary: EffectiveAgentModelSummary;
  isImporting: boolean;
  onImportLocalAgentConfigToModelSettings: () => void;
  configPaths: string[];
}

export const AgentConfigSourceSection: React.FC<AgentConfigSourceSectionProps> = ({
  selectedExternalAgentAppType,
  selectedAgentConfigSource,
  isSaving,
  applyProgress,
  onSelectAgentConfigSource,
  opencodePermissionMode,
  onSelectOpenCodePermissionMode,
  claudeCodePermissionMode,
  onSelectClaudeCodePermissionMode,
  deepseekTuiPermissionMode,
  onSelectDeepSeekTuiPermissionMode,
  selectedAgentProviderList,
  selectedAgentProvider,
  agentProviderLoadingAppType,
  agentProviderSwitchingId,
  onRefreshAgentProviders,
  onSelectAgentProvider,
  opencodeGlobalSyncing,
  onSyncOpenCodeGlobalConfig,
  deepseekTuiGlobalSyncing,
  onSyncDeepSeekTuiGlobalConfig,
  effectiveAgentModelSummary,
  isImporting,
  onImportLocalAgentConfigToModelSettings,
  configPaths,
}) => {
  if (!selectedExternalAgentAppType || !selectedAgentConfigSource) {
    return null;
  }

  const sourceOptions = [
    {
      value: ExternalAgentConfigSourceValue.AgoraModel,
      labelKey: 'coworkAgentConfigSourceAgoraModel',
      hintKey: 'coworkAgentConfigSourceAgoraModelHint',
    },
    {
      value: ExternalAgentConfigSourceValue.LocalCli,
      labelKey: 'coworkAgentConfigSourceLocalCli',
      hintKey: 'coworkAgentConfigSourceLocalCliHint',
    },
  ];

  const localProviders = selectedAgentProviderList?.providers ?? [];
  const isRefreshingProviders = agentProviderLoadingAppType === selectedExternalAgentAppType;

  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div>
        <div className="text-sm font-medium text-foreground">
          {i18nService.t('coworkAgentConfigSourceTitle')}
        </div>
        <div className="mt-1 text-xs leading-5 text-secondary">
          {i18nService.t('coworkAgentConfigSourceHint')}
        </div>
      </div>

      {applyProgress}

      <div className="grid gap-3 sm:grid-cols-2">
        {sourceOptions.map((option) => {
          const checked = selectedAgentConfigSource === option.value;
          return (
            <label
              key={option.value}
              className={`flex gap-3 rounded-xl border px-3 py-3 transition-colors ${isSaving ? 'cursor-wait opacity-70' : 'cursor-pointer'} ${checked
                ? 'border-primary bg-primary/5'
                : `border-border ${isSaving ? '' : 'hover:bg-surface-raised'}`}`}
            >
              <input
                type="radio"
                name="external-agent-config-source"
                checked={checked}
                disabled={isSaving}
                onChange={() => onSelectAgentConfigSource(option.value)}
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

      {selectedExternalAgentAppType === 'opencode' && (
        <div className="rounded-xl border border-border px-3 py-3">
          <div className="text-xs font-medium text-foreground">
            {i18nService.t('coworkAgentOpenCodePermissionTitle')}
          </div>
          <div className="mt-1 text-[11px] leading-5 text-secondary">
            {i18nService.t('coworkAgentOpenCodePermissionHint')}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: OpenCodePermissionModeValue.Auto,
                labelKey: 'coworkAgentOpenCodePermissionAuto',
                hintKey: 'coworkAgentOpenCodePermissionAutoHint',
              },
              {
                value: OpenCodePermissionModeValue.Conservative,
                labelKey: 'coworkAgentOpenCodePermissionConservative',
                hintKey: 'coworkAgentOpenCodePermissionConservativeHint',
              },
            ].map((option) => {
              const checked = opencodePermissionMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex gap-3 rounded-lg border px-3 py-2 ${checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-raised'}`}
                >
                  <input
                    type="radio"
                    name="opencode-permission-mode"
                    checked={checked}
                    disabled={isSaving}
                    onChange={() => onSelectOpenCodePermissionMode(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-xs font-medium text-foreground">
                      {i18nService.t(option.labelKey)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-secondary">
                      {i18nService.t(option.hintKey)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {selectedExternalAgentAppType === 'claude' && (
        <div className="rounded-xl border border-border px-3 py-3">
          <div className="text-xs font-medium text-foreground">
            {i18nService.t('coworkAgentClaudeCodePermissionTitle')}
          </div>
          <div className="mt-1 text-[11px] leading-5 text-secondary">
            {i18nService.t('coworkAgentClaudeCodePermissionHint')}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: ClaudeCodePermissionModeValue.BypassPermissions,
                labelKey: 'coworkAgentClaudeCodePermissionAuto',
                hintKey: 'coworkAgentClaudeCodePermissionAutoHint',
              },
              {
                value: ClaudeCodePermissionModeValue.Default,
                labelKey: 'coworkAgentClaudeCodePermissionDefault',
                hintKey: 'coworkAgentClaudeCodePermissionDefaultHint',
              },
              {
                value: ClaudeCodePermissionModeValue.Plan,
                labelKey: 'coworkAgentClaudeCodePermissionPlan',
                hintKey: 'coworkAgentClaudeCodePermissionPlanHint',
              },
              {
                value: ClaudeCodePermissionModeValue.AcceptEdits,
                labelKey: 'coworkAgentClaudeCodePermissionAcceptEdits',
                hintKey: 'coworkAgentClaudeCodePermissionAcceptEditsHint',
              },
            ].map((option) => {
              const checked = claudeCodePermissionMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex gap-3 rounded-lg border px-3 py-2 ${checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-raised'}`}
                >
                  <input
                    type="radio"
                    name="claude-code-permission-mode"
                    checked={checked}
                    disabled={isSaving}
                    onChange={() => onSelectClaudeCodePermissionMode(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-xs font-medium text-foreground">
                      {i18nService.t(option.labelKey)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-secondary">
                      {i18nService.t(option.hintKey)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {selectedExternalAgentAppType === 'deepseek_tui' && (
        <div className="rounded-xl border border-border px-3 py-3">
          <div className="text-xs font-medium text-foreground">
            {i18nService.t('coworkAgentDeepSeekTuiPermissionTitle')}
          </div>
          <div className="mt-1 text-[11px] leading-5 text-secondary">
            {i18nService.t('coworkAgentDeepSeekTuiPermissionHint')}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: DeepSeekTuiPermissionModeValue.Auto,
                labelKey: 'coworkAgentDeepSeekTuiPermissionAuto',
                hintKey: 'coworkAgentDeepSeekTuiPermissionAutoHint',
              },
              {
                value: DeepSeekTuiPermissionModeValue.Conservative,
                labelKey: 'coworkAgentDeepSeekTuiPermissionConservative',
                hintKey: 'coworkAgentDeepSeekTuiPermissionConservativeHint',
              },
            ].map((option) => {
              const checked = deepseekTuiPermissionMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex gap-3 rounded-lg border px-3 py-2 ${checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-raised'}`}
                >
                  <input
                    type="radio"
                    name="deepseek-tui-permission-mode"
                    checked={checked}
                    disabled={isSaving}
                    onChange={() => onSelectDeepSeekTuiPermissionMode(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-xs font-medium text-foreground">
                      {i18nService.t(option.labelKey)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-secondary">
                      {i18nService.t(option.hintKey)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {selectedAgentConfigSource === ExternalAgentConfigSourceValue.LocalCli && (
        <div className="rounded-xl border border-border px-3 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-medium text-foreground">
                {i18nService.t('coworkAgentLocalModelTitle')}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-secondary">
                {i18nService.t('coworkAgentLocalModelHint')}
              </div>
            </div>
            <button
              type="button"
              onClick={onRefreshAgentProviders}
              disabled={isRefreshingProviders}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised disabled:cursor-wait disabled:opacity-50"
            >
              {i18nService.t(isRefreshingProviders
                ? 'coworkAgentLocalModelRefreshing'
                : 'coworkAgentLocalModelRefresh')}
            </button>
          </div>
          <select
            value={selectedAgentProvider?.id ?? ''}
            onChange={(event) => onSelectAgentProvider(event.target.value)}
            disabled={
              isRefreshingProviders
              || Boolean(agentProviderSwitchingId)
              || localProviders.length === 0
            }
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-wait disabled:opacity-70"
          >
            {localProviders.length === 0 ? (
              <option value="">
                {i18nService.t(isRefreshingProviders
                  ? 'loading'
                  : 'coworkAgentLocalModelEmpty')}
              </option>
            ) : (
              localProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.summary.model
                    ? `${provider.name} · ${provider.summary.model}`
                    : provider.name}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {selectedExternalAgentAppType === 'opencode' && selectedAgentConfigSource === ExternalAgentConfigSourceValue.AgoraModel && (
        <div className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-5 text-secondary">
            {i18nService.t('coworkAgentOpenCodeSyncGlobalHint')}
          </div>
          <button
            type="button"
            onClick={onSyncOpenCodeGlobalConfig}
            disabled={opencodeGlobalSyncing}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised disabled:cursor-wait disabled:opacity-50"
          >
            {i18nService.t(opencodeGlobalSyncing
              ? 'coworkAgentOpenCodeSyncGlobalSyncing'
              : 'coworkAgentOpenCodeSyncGlobal')}
          </button>
        </div>
      )}

      {selectedExternalAgentAppType === 'deepseek_tui' && selectedAgentConfigSource === ExternalAgentConfigSourceValue.AgoraModel && (
        <div className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-5 text-secondary">
            {i18nService.t('coworkAgentDeepSeekTuiSyncGlobalHint')}
          </div>
          <button
            type="button"
            onClick={onSyncDeepSeekTuiGlobalConfig}
            disabled={deepseekTuiGlobalSyncing}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised disabled:cursor-wait disabled:opacity-50"
          >
            {i18nService.t(deepseekTuiGlobalSyncing
              ? 'coworkAgentDeepSeekTuiSyncGlobalSyncing'
              : 'coworkAgentDeepSeekTuiSyncGlobal')}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border px-3 py-3">
        <div className="text-xs font-medium text-foreground">
          {i18nService.t('coworkAgentCurrentModelTitle')}
        </div>
        <div className="mt-2 grid gap-1.5 text-[11px] leading-5 text-secondary sm:grid-cols-2">
          <div>
            {i18nService.t('coworkAgentCurrentModelProvider')}: <span className="text-foreground">{effectiveAgentModelSummary.providerName}</span>
          </div>
          <div>
            {i18nService.t('coworkAgentCurrentModelModel')}: <span className="font-mono text-foreground">{effectiveAgentModelSummary.modelId}</span>
          </div>
          {effectiveAgentModelSummary.apiFormat && (
            <div>
              {i18nService.t('coworkAgentCurrentModelFormat')}: <span className="font-mono text-foreground">{effectiveAgentModelSummary.apiFormat}</span>
            </div>
          )}
          {effectiveAgentModelSummary.baseUrl && (
            <div className="truncate" title={effectiveAgentModelSummary.baseUrl}>
              {i18nService.t('coworkAgentCurrentModelBaseUrl')}: <span className="font-mono text-foreground">{effectiveAgentModelSummary.baseUrl}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-5 text-secondary">
          {i18nService.t('coworkAgentConfigImportModelHint')}
        </div>
        <button
          type="button"
          onClick={onImportLocalAgentConfigToModelSettings}
          disabled={isImporting}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised disabled:opacity-50"
        >
          {i18nService.t(isImporting ? 'coworkAgentConfigImportModelImporting' : 'coworkAgentConfigImportModel')}
        </button>
      </div>

      {configPaths.length > 0 && (
        <div className="space-y-1 text-[11px] text-secondary">
          <div>{i18nService.t('coworkAgentConfigLocalPath')}</div>
          {configPaths.map((configPath) => (
            <div key={configPath} className="truncate font-mono" title={configPath}>
              {configPath}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
