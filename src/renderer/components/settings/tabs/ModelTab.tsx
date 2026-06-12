import { XCircleIcon as XCircleIconSolid } from '@heroicons/react/20/solid';
import { SignalIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useRef } from 'react';

import { ProviderRegistry } from '../../../../shared/providers';
import {
  defaultConfig,
  getCustomProviderDefaultName,
  getProviderDisplayName,
  isCustomProvider,
} from '../../../config';
import { i18nService } from '../../../services/i18n';
import PlusCircleIcon from '../../icons/PlusCircleIcon';
import { useProviderImportExport } from '../hooks/useProviderImportExport';
import { useProviderTestConnection } from '../hooks/useProviderTestConnection';
import { TestResultModal } from '../modals/TestResultModal';
import {
  CUSTOM_PROVIDER_KEYS,
  getEffectiveApiFormat,
  getProviderDefaultBaseUrl,
  type ProviderConfig,
  providerKeys,
  providerRequiresApiKey,
  type ProvidersConfig,
  type ProviderType,
  resolveBaseUrl,
  shouldShowApiFormatSelector,
} from '../providerConfigUtils';
import { ApiKeySection } from './ApiKeySection';
import {
  type CopilotAuthStatus,
  GitHubCopilotAuthSection,
} from './GitHubCopilotAuthSection';
import {
  type MiniMaxOAuthPhase,
  MiniMaxOAuthSection,
} from './MiniMaxOAuthSection';
import { ModelsListSection } from './ModelsListSection';
import { ProviderConfigHeader } from './ProviderConfigHeader';
import { ProviderListSidebar } from './ProviderListSidebar';

type ProviderMetaEntry = {
  label: string;
  icon: React.ReactNode;
};

type ProviderLinkEntry = {
  website: string;
  apiKey?: string;
};

type CodingPlanProvider = 'zhipu' | 'qwen' | 'volcengine' | 'moonshot';
type ModelProviderConfig = ProviderConfig & {
  codingPlanEnabled?: boolean;
};

const CODING_PLAN_ENDPOINT_HINT_KEYS: Record<CodingPlanProvider, string> = {
  zhipu: 'zhipuCodingPlanEndpointHint',
  qwen: 'qwenCodingPlanEndpointHint',
  volcengine: 'volcengineCodingPlanEndpointHint',
  moonshot: 'moonshotCodingPlanEndpointHint',
};

const CODING_PLAN_HINT_KEYS: Record<CodingPlanProvider, string> = {
  zhipu: 'zhipuCodingPlanHint',
  qwen: 'qwenCodingPlanHint',
  volcengine: 'volcengineCodingPlanHint',
  moonshot: 'moonshotCodingPlanHint',
};

const CODING_PLAN_TITLES: Record<CodingPlanProvider, string> = {
  zhipu: 'GLM Coding Plan',
  qwen: 'Coding Plan',
  volcengine: 'Coding Plan',
  moonshot: 'Coding Plan',
};

const getCodingPlanBadge = (provider: CodingPlanProvider): string => (
  provider === 'qwen' ? i18nService.t('codingPlanSubscriptionBadge') : 'Beta'
);

const isCodingPlanProvider = (
  provider: ProviderType,
): provider is CodingPlanProvider => (
  provider === 'zhipu'
  || provider === 'qwen'
  || provider === 'volcengine'
  || provider === 'moonshot'
);

export interface ModelTabProps {
  visibleProviders: ProvidersConfig;
  providers: ProvidersConfig;
  providerMeta: Record<ProviderType, ProviderMetaEntry>;
  providerLinks: Partial<Record<ProviderType, ProviderLinkEntry>>;
  activeProvider: ProviderType;
  setProviders: React.Dispatch<React.SetStateAction<ProvidersConfig>>;
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  minimaxIsOAuthMode: boolean;
  minimaxOAuthPhase: MiniMaxOAuthPhase;
  copilotAuthStatus: CopilotAuthStatus;
  copilotUserCode: string;
  copilotVerificationUri: string;
  copilotGithubUser: string;
  copilotError: string | null;
  isBaseUrlLocked: boolean;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setNoticeMessage: React.Dispatch<React.SetStateAction<string | null>>;
  onProviderChange: (provider: ProviderType) => void;
  onAddCustomProvider: () => void;
  onDeleteCustomProvider: (provider: ProviderType) => void;
  onToggleProviderEnabled: (provider: ProviderType) => void;
  onProviderConfigChange: (
    provider: ProviderType,
    field: string,
    value: string,
  ) => void;
  onSelectMiniMaxOAuth: () => void;
  onSelectMiniMaxApiKey: () => void;
  onMiniMaxSignIn: () => void;
  onCancelMiniMaxLogin: () => void;
  onMiniMaxSignOut: () => void;
  onCopilotSignIn: () => void;
  onCopilotCancelAuth: () => void;
  onCopilotSignOut: () => void;
  onAddModel: () => void;
  onEditModel: (modelId: string, modelName: string, supportsImage?: boolean) => void;
  onDeleteModel: (modelId: string) => void;
}

export const ModelTab: React.FC<ModelTabProps> = ({
  visibleProviders,
  providers,
  setProviders,
  providerMeta,
  providerLinks,
  activeProvider,
  showApiKey,
  setShowApiKey,
  minimaxIsOAuthMode,
  minimaxOAuthPhase,
  copilotAuthStatus,
  copilotUserCode,
  copilotVerificationUri,
  copilotGithubUser,
  copilotError,
  isBaseUrlLocked,
  setError,
  setNoticeMessage,
  onProviderChange,
  onAddCustomProvider,
  onDeleteCustomProvider,
  onToggleProviderEnabled,
  onProviderConfigChange,
  onSelectMiniMaxOAuth,
  onSelectMiniMaxApiKey,
  onMiniMaxSignIn,
  onCancelMiniMaxLogin,
  onMiniMaxSignOut,
  onCopilotSignIn,
  onCopilotCancelAuth,
  onCopilotSignOut,
  onAddModel,
  onEditModel,
  onDeleteModel,
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  const {
    isTesting,
    isTestResultModalOpen,
    testResult,
    handleTestConnection,
    closeTestResultModal,
    resetTestResult,
  } = useProviderTestConnection({
    providers,
    activeProvider,
    setProviders,
  });

  useEffect(() => {
    resetTestResult();
  }, [activeProvider, resetTestResult]);

  const providerImportExport = useProviderImportExport({
    providers,
    setProviders,
    providerKeys,
    importInputRef,
    setError,
    setNoticeMessage,
    getEffectiveApiFormat,
    resolveBaseUrl,
  });

  const currentProvider = providers[activeProvider] as ModelProviderConfig;
  const effectiveApiFormat = getEffectiveApiFormat(
    activeProvider,
    currentProvider.apiFormat,
  );
  const providerName = isCustomProvider(activeProvider)
    ? (
      (currentProvider as ProviderConfig)?.displayName
      || getCustomProviderDefaultName(activeProvider)
    )
    : (providerMeta[activeProvider]?.label ?? getProviderDisplayName(activeProvider));
  const baseUrlValue = (() => {
    if (effectiveApiFormat !== 'gemini') {
      const codingPlanUrl = currentProvider.codingPlanEnabled
        ? ProviderRegistry.getCodingPlanUrl(activeProvider, effectiveApiFormat)
        : undefined;
      if (codingPlanUrl) {
        return codingPlanUrl;
      }
    }
    return currentProvider.baseUrl;
  })();
  const baseUrlPlaceholder = activeProvider === 'qwen'
    ? 'https://dashscope.aliyuncs.com/apps/anthropic'
    : (
      getProviderDefaultBaseUrl(activeProvider, effectiveApiFormat)
      || defaultConfig.providers?.[activeProvider]?.baseUrl
      || i18nService.t('baseUrlPlaceholder')
    );
  const qwenHasOauthCredentials = Boolean(
    (providers.qwen as { oauthCredentials?: unknown } | undefined)?.oauthCredentials,
  );
  const testConnectionDisabled = isTesting || (
    providerRequiresApiKey(activeProvider)
    && !currentProvider.apiKey
    && !(activeProvider === 'qwen' && qwenHasOauthCredentials)
  );

  const renderCodingPlanEndpointHint = () => {
    if (!isCodingPlanProvider(activeProvider) || !currentProvider.codingPlanEnabled) {
      return null;
    }

    return (
      <div className="mt-1.5 p-2 rounded-lg bg-primary-muted border border-primary-muted">
        <p className="text-[11px] text-primary dark:text-primary">
          <span className="font-medium">{CODING_PLAN_TITLES[activeProvider]}:</span>{' '}
          {i18nService.t(CODING_PLAN_ENDPOINT_HINT_KEYS[activeProvider])}
        </p>
      </div>
    );
  };

  const renderCodingPlanToggle = () => {
    if (!isCodingPlanProvider(activeProvider)) {
      return null;
    }

    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-foreground">
              {CODING_PLAN_TITLES[activeProvider]}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary-muted text-primary">
              {getCodingPlanBadge(activeProvider)}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-secondary">
            {i18nService.t(CODING_PLAN_HINT_KEYS[activeProvider])}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-3">
          <input
            type="checkbox"
            checked={currentProvider.codingPlanEnabled ?? false}
            onChange={(e) => onProviderConfigChange(
              activeProvider,
              'codingPlanEnabled',
              e.target.checked ? 'true' : 'false',
            )}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
        </label>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      <ProviderListSidebar
        visibleProviders={visibleProviders as unknown as Record<string, ProviderConfig>}
        providers={providers as unknown as Record<string, ProviderConfig>}
        providerMeta={providerMeta}
        customProviderKeys={CUSTOM_PROVIDER_KEYS}
        activeProvider={activeProvider}
        importInputRef={importInputRef}
        isImportingProviders={providerImportExport.isImportingProviders}
        isExportingProviders={providerImportExport.isExportingProviders}
        handleProviderChange={(provider) => onProviderChange(provider as ProviderType)}
        handleAddCustomProvider={onAddCustomProvider}
        handleDeleteCustomProvider={(provider) => onDeleteCustomProvider(provider as ProviderType)}
        toggleProviderEnabled={(provider) => onToggleProviderEnabled(provider as ProviderType)}
        handleImportProvidersClick={providerImportExport.handleImportProvidersClick}
        handleImportProviders={providerImportExport.handleImportProviders}
        handleExportProviders={providerImportExport.handleExportProviders}
        providerRequiresApiKey={(provider) => providerRequiresApiKey(provider as ProviderType)}
      />

      <div className="w-3/5 pl-4 pr-2 space-y-4 overflow-y-auto [scrollbar-gutter:stable]">
        <ProviderConfigHeader
          providerName={providerName}
          websiteUrl={providerLinks[activeProvider]?.website}
          enabled={currentProvider.enabled}
        />

        {activeProvider === 'minimax' && (
          <MiniMaxOAuthSection
            isOAuthMode={minimaxIsOAuthMode}
            onSelectOAuth={onSelectMiniMaxOAuth}
            onSelectApiKey={onSelectMiniMaxApiKey}
            apiKey={providers.minimax.apiKey}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            onApiKeyChange={(value) => onProviderConfigChange('minimax', 'apiKey', value)}
            apiKeyLink={providerLinks.minimax?.apiKey}
            phase={minimaxOAuthPhase}
            hasApiKey={!!providers.minimax.apiKey}
            onSignIn={onMiniMaxSignIn}
            onCancel={onCancelMiniMaxLogin}
            onSignOut={onMiniMaxSignOut}
          />
        )}

        {providerRequiresApiKey(activeProvider) && activeProvider !== 'minimax' && (
          <div>
            {activeProvider !== 'qwen' ? (
              <ApiKeySection
                activeProvider={activeProvider}
                apiKey={currentProvider.apiKey}
                showApiKey={showApiKey}
                setShowApiKey={setShowApiKey}
                onChange={(value) => onProviderConfigChange(activeProvider, 'apiKey', value)}
                apiKeyLink={providerLinks[activeProvider]?.apiKey}
              />
            ) : (
              <ApiKeySection
                activeProvider="qwen"
                apiKey={providers.qwen.apiKey}
                showApiKey={showApiKey}
                setShowApiKey={setShowApiKey}
                onChange={(value) => onProviderConfigChange('qwen', 'apiKey', value)}
                apiKeyLink={providerLinks.qwen?.apiKey}
              />
            )}
          </div>
        )}

        {activeProvider === 'github-copilot' && (
          <GitHubCopilotAuthSection
            status={copilotAuthStatus}
            userCode={copilotUserCode}
            verificationUri={copilotVerificationUri}
            githubUser={copilotGithubUser}
            hasApiKey={!!providers['github-copilot'].apiKey}
            errorMessage={copilotError}
            onSignIn={onCopilotSignIn}
            onCancel={onCopilotCancelAuth}
            onSignOut={onCopilotSignOut}
          />
        )}

        {isCustomProvider(activeProvider) && (
          <div>
            <label
              htmlFor={`${activeProvider}-displayName`}
              className="block text-xs font-medium dark:text-claude-darkText text-claude-text mb-1"
            >
              {i18nService.t('customDisplayName')}
            </label>
            <input
              type="text"
              id={`${activeProvider}-displayName`}
              value={(currentProvider as ProviderConfig)?.displayName ?? ''}
              onChange={(e) => onProviderConfigChange(activeProvider, 'displayName', e.target.value)}
              className="block w-full rounded-xl bg-claude-surfaceInset dark:bg-claude-darkSurfaceInset dark:border-claude-darkBorder border-claude-border border focus:border-claude-accent focus:ring-1 focus:ring-claude-accent/30 dark:text-claude-darkText text-claude-text px-3 py-2 text-xs"
              placeholder={i18nService.t('customDisplayNamePlaceholder')}
            />
          </div>
        )}

        {!(activeProvider === 'minimax' && minimaxIsOAuthMode) && (
          <div>
            <label htmlFor={`${activeProvider}-baseUrl`} className="block text-xs font-medium text-foreground mb-1">
              {i18nService.t('baseUrl')}
            </label>
            <div className="relative">
              <input
                type="text"
                id={`${activeProvider}-baseUrl`}
                value={baseUrlValue}
                onChange={(e) => onProviderConfigChange(activeProvider, 'baseUrl', e.target.value)}
                disabled={isBaseUrlLocked}
                className={`block w-full rounded-xl bg-claude-surfaceInset dark:bg-claude-darkSurfaceInset dark:border-claude-darkBorder border-claude-border border focus:border-claude-accent focus:ring-1 focus:ring-claude-accent/30 dark:text-claude-darkText text-claude-text px-3 py-2 pr-8 text-xs ${isBaseUrlLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder={baseUrlPlaceholder}
              />
              {currentProvider.baseUrl && !isBaseUrlLocked && (
                <div className="absolute right-2 inset-y-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => onProviderConfigChange(activeProvider, 'baseUrl', '')}
                    className="p-0.5 rounded text-claude-textSecondary dark:text-claude-darkTextSecondary hover:text-claude-accent transition-colors"
                    title={i18nService.t('clear') || 'Clear'}
                  >
                    <XCircleIconSolid className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {isCustomProvider(activeProvider) && (
              <div className="mt-1.5 space-y-0.5 text-[11px] text-secondary">
                <p>
                  <span className="text-sm text-muted mr-1">•</span>
                  {i18nService.t('baseUrlHint1')}
                  <code className="ml-1 text-primary break-all">{i18nService.t('baseUrlHintExample1')}</code>
                </p>
                <p>
                  <span className="text-sm text-muted mr-1">•</span>
                  {i18nService.t('baseUrlHint2')}
                  <code className="ml-1 text-primary break-all">{i18nService.t('baseUrlHintExample2')}</code>
                </p>
              </div>
            )}
            {renderCodingPlanEndpointHint()}
          </div>
        )}

        {shouldShowApiFormatSelector(activeProvider) && !(activeProvider === 'minimax' && minimaxIsOAuthMode) && (
          <div>
            <label htmlFor={`${activeProvider}-apiFormat`} className="block text-xs font-medium text-foreground mb-1">
              {i18nService.t('apiFormat')}
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${activeProvider}-apiFormat`}
                  value="anthropic"
                  checked={effectiveApiFormat !== 'openai'}
                  onChange={() => onProviderConfigChange(activeProvider, 'apiFormat', 'anthropic')}
                  className="h-3.5 w-3.5 text-claude-accent focus:ring-claude-accent dark:bg-claude-darkSurface bg-claude-surface disabled:opacity-50"
                />
                <span className="ml-2 text-xs text-foreground">
                  {i18nService.t('apiFormatNative')}
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${activeProvider}-apiFormat`}
                  value="openai"
                  checked={effectiveApiFormat === 'openai'}
                  onChange={() => onProviderConfigChange(activeProvider, 'apiFormat', 'openai')}
                  className="h-3.5 w-3.5 text-claude-accent focus:ring-claude-accent dark:bg-claude-darkSurface bg-claude-surface disabled:opacity-50"
                />
                <span className="ml-2 text-xs text-foreground">
                  {i18nService.t('apiFormatOpenAI')}
                </span>
              </label>
            </div>
            <p className="mt-1 text-xs text-secondary">
              {i18nService.t('apiFormatHint')}
            </p>
          </div>
        )}

        {renderCodingPlanToggle()}

        {!(activeProvider === 'minimax' && minimaxIsOAuthMode) && (
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testConnectionDisabled}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-xl border dark:border-claude-darkBorder border-claude-border dark:text-claude-darkText text-claude-text dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
            >
              <SignalIcon className="h-3.5 w-3.5 mr-1.5" />
              {isTesting ? i18nService.t('testing') : i18nService.t('testConnection')}
            </button>
          </div>
        )}

        {isTestResultModalOpen && testResult && (
          <TestResultModal
            providerLabel={providerMeta[testResult.provider]?.label ?? testResult.provider}
            success={!!testResult.success}
            message={testResult.message}
            onClose={closeTestResultModal}
          />
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-medium text-foreground">
              {i18nService.t('availableModels')}
            </h3>
            <button
              type="button"
              onClick={onAddModel}
              className="inline-flex items-center text-xs text-primary hover:text-primary-hover"
            >
              <PlusCircleIcon className="h-3.5 w-3.5 mr-1" />
              {i18nService.t('addModel')}
            </button>
          </div>

          <ModelsListSection
            models={currentProvider.models}
            onAddModel={onAddModel}
            onEditModel={(model) => onEditModel(model.id, model.name, model.supportsImage)}
            onDeleteModel={onDeleteModel}
          />
        </div>
      </div>
    </div>
  );
};
