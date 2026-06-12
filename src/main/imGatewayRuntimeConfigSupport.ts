import type { SqliteStore } from './sqliteStore';

type LLMConfigResult = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
} | null;

type LLMProviderConfig = {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  models?: Array<{ id?: string }>;
};

type AppConfigRecord = {
  providers?: Record<string, LLMProviderConfig>;
  api?: {
    key?: string;
    baseUrl?: string;
  };
  model?: {
    defaultModel?: string;
  };
};

export function buildLLMConfigFromStore(
  store: SqliteStore,
): LLMConfigResult {
  const appConfig = store.get<AppConfigRecord>('app_config');
  if (!appConfig) return null;

  const providers = appConfig.providers || {};
  for (const [providerName, providerConfig] of Object.entries(providers)) {
    if (providerConfig.enabled && providerConfig.apiKey) {
      const model = providerConfig.models?.[0]?.id;
      return {
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        model,
        provider: providerName,
      };
    }
  }

  if (appConfig.api?.key) {
    return {
      apiKey: appConfig.api.key,
      baseUrl: appConfig.api.baseUrl,
      model: appConfig.model?.defaultModel,
    };
  }

  return null;
}
