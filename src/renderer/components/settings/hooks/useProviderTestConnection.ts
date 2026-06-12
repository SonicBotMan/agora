import React, { useCallback, useState } from 'react';

import { resolveCodingPlanBaseUrl } from '../../../../shared/providers';
import { defaultConfig } from '../../../config';
import { i18nService } from '../../../services/i18n';
import {
  buildOpenAICompatibleChatCompletionsUrl,
  buildOpenAIResponsesUrl,
  getEffectiveApiFormat,
  providerRequiresApiKey,
  type ProvidersConfig,
  type ProviderType,
  resolveBaseUrl,
  shouldUseMaxCompletionTokensForOpenAI,
  shouldUseOpenAIResponsesForProvider,
} from '../providerConfigUtils';

const CONNECTIVITY_TEST_TOKEN_BUDGET = 64;

export type ProviderConnectionTestResult = {
  success: boolean;
  message: string;
  provider: ProviderType;
};

export interface UseProviderTestConnectionArgs {
  providers: ProvidersConfig;
  activeProvider: ProviderType;
  setProviders: React.Dispatch<React.SetStateAction<ProvidersConfig>>;
}

export interface UseProviderTestConnectionResult {
  isTesting: boolean;
  isTestResultModalOpen: boolean;
  testResult: ProviderConnectionTestResult | null;
  handleTestConnection: () => Promise<void>;
  closeTestResultModal: () => void;
  resetTestResult: () => void;
}

export const useProviderTestConnection = ({
  providers,
  activeProvider,
  setProviders,
}: UseProviderTestConnectionArgs): UseProviderTestConnectionResult => {
  const [isTesting, setIsTesting] = useState(false);
  const [isTestResultModalOpen, setIsTestResultModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);

  const enableProvider = useCallback((provider: ProviderType) => {
    setProviders((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        enabled: true,
      },
    }));
  }, [setProviders]);

  const closeTestResultModal = useCallback(() => {
    setIsTestResultModalOpen(false);
    setTestResult(null);
  }, []);

  const resetTestResult = useCallback(() => {
    setIsTestResultModalOpen(false);
    setTestResult(null);
  }, []);

  const handleTestConnection = useCallback(async () => {
    const testingProvider = activeProvider;
    const providerConfig = providers[testingProvider];
    setIsTesting(true);
    setIsTestResultModalOpen(false);
    setTestResult(null);

    // Check if provider has valid authentication (API Key or OAuth for Qwen)
    const hasValidAuth = providerConfig.apiKey
      || (testingProvider === 'qwen' && (providerConfig as { oauthCredentials?: unknown }).oauthCredentials);

    if (providerRequiresApiKey(testingProvider) && !hasValidAuth) {
      setTestResult({
        success: false,
        message: i18nService.t('apiKeyRequired'),
        provider: testingProvider,
      });
      setIsTestResultModalOpen(true);
      setIsTesting(false);
      return;
    }

    // 获取第一个可用模型 - use a shallow copy to avoid mutating state
    const originalModel = providerConfig.models?.[0];
    if (!originalModel) {
      setTestResult({
        success: false,
        message: i18nService.t('noModelsConfigured'),
        provider: testingProvider,
      });
      setIsTestResultModalOpen(true);
      setIsTesting(false);
      return;
    }

    const firstModel = { ...originalModel };

    try {
      let response: Awaited<ReturnType<typeof window.electron.api.fetch>>;
      // Apply Coding Plan endpoint switch
      let effectiveBaseUrl = resolveBaseUrl(
        testingProvider,
        providerConfig.baseUrl,
        getEffectiveApiFormat(testingProvider, providerConfig.apiFormat),
      );
      let effectiveApiFormat = getEffectiveApiFormat(testingProvider, providerConfig.apiFormat);

      // Handle Coding Plan endpoint switch for supported providers
      if (
        (providerConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled
        && (effectiveApiFormat === 'anthropic' || effectiveApiFormat === 'openai')
      ) {
        const resolved = resolveCodingPlanBaseUrl(testingProvider, true, effectiveApiFormat, effectiveBaseUrl);
        effectiveBaseUrl = resolved.baseUrl;
        effectiveApiFormat = resolved.effectiveFormat;
      }

      const normalizedBaseUrl = effectiveBaseUrl.replace(/\/+$/, '');

      // Determine effective API key
      let effectiveApiKey = providerConfig.apiKey;

      if (testingProvider === 'qwen') {
        // Use regular API Key mode
        effectiveApiKey = providerConfig.apiKey;
        // Ensure model ID is not an OAuth-mapped name (vision-model/coder-model)
        // This can happen if a previous OAuth test mutated the model in state and it got persisted
        if (firstModel.id === 'vision-model' || firstModel.id === 'coder-model') {
          // Restore from defaultConfig's first qwen model
          const defaultQwenModel = defaultConfig.providers?.qwen?.models?.[0];
          firstModel.id = defaultQwenModel?.id || 'qwen3.5-plus';
        }
      }

      // Determine format after all overrides (OAuth may switch to openai)
      // 统一为两种协议格式：
      // - anthropic: /v1/messages
      // - openai provider: /v1/responses
      // - other openai-compatible providers: /v1/chat/completions
      const useAnthropicFormat = effectiveApiFormat === 'anthropic';

      if (useAnthropicFormat) {
        const anthropicUrl = normalizedBaseUrl.endsWith('/v1')
          ? `${normalizedBaseUrl}/messages`
          : `${normalizedBaseUrl}/v1/messages`;
        response = await window.electron.api.fetch({
          url: anthropicUrl,
          method: 'POST',
          headers: {
            'x-api-key': effectiveApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: firstModel.id,
            max_tokens: CONNECTIVITY_TEST_TOKEN_BUDGET,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
      } else {
        const useResponsesApi = shouldUseOpenAIResponsesForProvider(testingProvider);
        const openaiUrl = useResponsesApi
          ? buildOpenAIResponsesUrl(normalizedBaseUrl)
          : buildOpenAICompatibleChatCompletionsUrl(normalizedBaseUrl, testingProvider);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (effectiveApiKey) {
          headers.Authorization = `Bearer ${effectiveApiKey}`;
        }
        if (testingProvider === 'github-copilot') {
          headers['Copilot-Integration-Id'] = 'vscode-chat';
          headers['Editor-Version'] = 'vscode/1.96.2';
          headers['Editor-Plugin-Version'] = 'copilot-chat/0.26.7';
          headers['User-Agent'] = 'GitHubCopilotChat/0.26.7';
          headers['Openai-Intent'] = 'conversation-panel';
        }
        const openAIRequestBody: Record<string, unknown> = useResponsesApi
          ? {
              model: firstModel.id,
              input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }],
              max_output_tokens: CONNECTIVITY_TEST_TOKEN_BUDGET,
            }
          : {
              model: firstModel.id,
              messages: [{ role: 'user', content: 'Hi' }],
            };
        if (!useResponsesApi && shouldUseMaxCompletionTokensForOpenAI(testingProvider, firstModel.id)) {
          openAIRequestBody.max_completion_tokens = CONNECTIVITY_TEST_TOKEN_BUDGET;
        } else if (!useResponsesApi) {
          openAIRequestBody.max_tokens = CONNECTIVITY_TEST_TOKEN_BUDGET;
        }
        response = await window.electron.api.fetch({
          url: openaiUrl,
          method: 'POST',
          headers,
          body: JSON.stringify(openAIRequestBody),
        });
      }

      if (response.ok) {
        enableProvider(testingProvider);
        setTestResult({
          success: true,
          message: i18nService.t('connectionSuccess'),
          provider: testingProvider,
        });
        setIsTestResultModalOpen(true);
      } else {
        const data = response.data || {};
        // 提取错误信息
        const errorMessage = data.error?.message || data.message
          || `${i18nService.t('connectionFailed')}: ${response.status}`;
        if (typeof errorMessage === 'string'
          && errorMessage.toLowerCase().includes('model output limit was reached')) {
          enableProvider(testingProvider);
          setTestResult({
            success: true,
            message: i18nService.t('connectionSuccess'),
            provider: testingProvider,
          });
          setIsTestResultModalOpen(true);
          return;
        }
        setTestResult({
          success: false,
          message: errorMessage,
          provider: testingProvider,
        });
        setIsTestResultModalOpen(true);
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : i18nService.t('connectionFailed'),
        provider: testingProvider,
      });
      setIsTestResultModalOpen(true);
    } finally {
      setIsTesting(false);
    }
  }, [activeProvider, providers, enableProvider]);

  return {
    isTesting,
    isTestResultModalOpen,
    testResult,
    handleTestConnection,
    closeTestResultModal,
    resetTestResult,
  };
};
