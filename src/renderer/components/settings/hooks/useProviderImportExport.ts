import React, { useCallback, useState } from 'react';

import { APP_ID, EXPORT_FORMAT_TYPE, EXPORT_PASSWORD } from '../../../constants/app';
import {
  decryptSecret,
  decryptWithPassword,
  type EncryptedPayload,
  encryptWithPassword,
  type PasswordEncryptedPayload,
} from '../../../services/encryption';
import { i18nService } from '../../../services/i18n';
import type { Model, ProvidersConfig,ProviderType } from '../providerConfigUtils';

const DEFAULT_EXPORT_PASSWORD = EXPORT_PASSWORD;

export interface ProviderExportEntry {
  enabled: boolean;
  apiKey: PasswordEncryptedPayload;
  baseUrl: string;
  apiFormat?: 'anthropic' | 'openai' | 'gemini';
  codingPlanEnabled?: boolean;
  models?: Model[];
}

export interface ProvidersExportPayload {
  type: typeof EXPORT_FORMAT_TYPE;
  version: 2;
  exportedAt: string;
  encryption: {
    algorithm: 'AES-GCM';
    keySource: 'password';
    keyDerivation: 'PBKDF2';
  };
  providers: Record<string, ProviderExportEntry>;
}

export interface ProvidersImportEntry {
  enabled?: boolean;
  apiKey?: EncryptedPayload | PasswordEncryptedPayload | string;
  apiKeyEncrypted?: string;
  apiKeyIv?: string;
  baseUrl?: string;
  apiFormat?: 'anthropic' | 'openai' | 'native';
  codingPlanEnabled?: boolean;
  models?: Array<{ id: string; name: string; supportsImage?: boolean }>;
}

export interface ProvidersImportPayload {
  type?: string;
  version?: number;
  encryption?: {
    algorithm?: string;
    keySource?: string;
    keyDerivation?: string;
  };
  providers?: Record<string, ProvidersImportEntry>;
}

export interface UseProviderImportExportArgs {
  providers: ProvidersConfig;
  setProviders: React.Dispatch<React.SetStateAction<ProvidersConfig>>;
  providerKeys: readonly ProviderType[];
  importInputRef: React.RefObject<HTMLInputElement>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setNoticeMessage: React.Dispatch<React.SetStateAction<string | null>>;
  getEffectiveApiFormat: (provider: string, value: unknown) => 'anthropic' | 'openai' | 'gemini';
  resolveBaseUrl: (
    provider: ProviderType,
    baseUrl: string,
    apiFormat: 'anthropic' | 'openai' | 'gemini',
  ) => string;
}

export interface UseProviderImportExportResult {
  isImportingProviders: boolean;
  isExportingProviders: boolean;
  handleImportProvidersClick: () => void;
  handleImportProviders: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleExportProviders: () => Promise<void>;
}

const normalizeModels = (models?: Model[]) =>
  models?.map((model) => ({
    ...model,
    supportsImage: model.supportsImage ?? false,
  }));

export const useProviderImportExport = ({
  providers,
  setProviders,
  providerKeys,
  importInputRef,
  setError,
  setNoticeMessage,
  getEffectiveApiFormat,
  resolveBaseUrl,
}: UseProviderImportExportArgs): UseProviderImportExportResult => {
  const [isImportingProviders, setIsImportingProviders] = useState(false);
  const [isExportingProviders, setIsExportingProviders] = useState(false);

  const buildProvidersExport = useCallback(async (
    password: string,
  ): Promise<ProvidersExportPayload> => {
    const entries = await Promise.all(
      Object.entries(providers).map(async ([providerKey, providerConfig]) => {
        const apiKey = await encryptWithPassword(providerConfig.apiKey, password);
        const apiFormat = getEffectiveApiFormat(providerKey, providerConfig.apiFormat);
        return [
          providerKey,
          {
            enabled: providerConfig.enabled,
            apiKey,
            baseUrl: resolveBaseUrl(providerKey as ProviderType, providerConfig.baseUrl, apiFormat),
            apiFormat,
            codingPlanEnabled: (providerConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled,
            models: providerConfig.models,
          },
        ] as const;
      })
    );

    return {
      type: EXPORT_FORMAT_TYPE,
      version: 2,
      exportedAt: new Date().toISOString(),
      encryption: {
        algorithm: 'AES-GCM',
        keySource: 'password',
        keyDerivation: 'PBKDF2',
      },
      providers: Object.fromEntries(entries),
    };
  }, [providers, getEffectiveApiFormat, resolveBaseUrl]);

  const handleExportProviders = useCallback(async () => {
    setError(null);
    setIsExportingProviders(true);

    try {
      const payload = await buildProvidersExport(DEFAULT_EXPORT_PASSWORD);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_ID}-providers-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error('Failed to export providers:', err);
      setError(i18nService.t('exportProvidersFailed'));
    } finally {
      setIsExportingProviders(false);
    }
  }, [buildProvidersExport, setError]);

  const handleImportProvidersClick = useCallback(() => {
    importInputRef.current?.click();
  }, [importInputRef]);

  const processImportPayloadWithLocalKey = useCallback(async (
    payload: ProvidersImportPayload,
  ) => {
    setIsImportingProviders(true);
    try {
      const providerUpdates: Partial<ProvidersConfig> = {};
      let hadDecryptFailure = false;
      for (const providerKey of providerKeys) {
        const providerData = payload.providers?.[providerKey];
        if (!providerData) {
          continue;
        }

        let apiKey: string | undefined;
        if (typeof providerData.apiKey === 'string') {
          apiKey = providerData.apiKey;
        } else if (providerData.apiKey && typeof providerData.apiKey === 'object') {
          try {
            apiKey = await decryptSecret(providerData.apiKey as EncryptedPayload);
          } catch (error) {
            hadDecryptFailure = true;
            console.warn(`Failed to decrypt provider key for ${providerKey}`, error);
          }
        } else if (
          typeof providerData.apiKeyEncrypted === 'string'
          && typeof providerData.apiKeyIv === 'string'
        ) {
          try {
            apiKey = await decryptSecret({
              encrypted: providerData.apiKeyEncrypted,
              iv: providerData.apiKeyIv,
            });
          } catch (error) {
            hadDecryptFailure = true;
            console.warn(`Failed to decrypt provider key for ${providerKey}`, error);
          }
        }

        const models = normalizeModels(providerData.models);

        providerUpdates[providerKey] = {
          enabled: typeof providerData.enabled === 'boolean'
            ? providerData.enabled
            : providers[providerKey].enabled,
          apiKey: apiKey ?? providers[providerKey].apiKey,
          baseUrl: typeof providerData.baseUrl === 'string'
            ? providerData.baseUrl
            : providers[providerKey].baseUrl,
          apiFormat: getEffectiveApiFormat(
            providerKey,
            providerData.apiFormat ?? providers[providerKey].apiFormat,
          ),
          codingPlanEnabled: typeof providerData.codingPlanEnabled === 'boolean'
            ? providerData.codingPlanEnabled
            : (providers[providerKey] as { codingPlanEnabled?: boolean }).codingPlanEnabled,
          models: models ?? providers[providerKey].models,
        };
      }

      if (Object.keys(providerUpdates).length === 0) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      setProviders((prev) => {
        const next = { ...prev };
        Object.entries(providerUpdates).forEach(([providerKey, update]) => {
          next[providerKey] = {
            ...prev[providerKey],
            ...update,
          };
        });
        return next;
      });
      if (hadDecryptFailure) {
        setNoticeMessage(i18nService.t('decryptProvidersPartial'));
      }
    } catch (err) {
      console.error('Failed to import providers:', err);
      const isDecryptError = err instanceof Error
        && (err.message === 'Invalid encrypted payload' || err.name === 'OperationError');
      const message = isDecryptError
        ? i18nService.t('decryptProvidersFailed')
        : i18nService.t('importProvidersFailed');
      setError(message);
    } finally {
      setIsImportingProviders(false);
    }
  }, [providerKeys, providers, getEffectiveApiFormat, setProviders, setError, setNoticeMessage]);

  const processImportPayloadWithPassword = useCallback(async (
    payload: ProvidersImportPayload,
  ) => {
    if (!payload.providers) {
      return;
    }

    setIsImportingProviders(true);

    try {
      const providerUpdates: Partial<ProvidersConfig> = {};
      let hadDecryptFailure = false;

      for (const providerKey of providerKeys) {
        const providerData = payload.providers[providerKey];
        if (!providerData) {
          continue;
        }

        let apiKey: string | undefined;
        if (typeof providerData.apiKey === 'string') {
          apiKey = providerData.apiKey;
        } else if (providerData.apiKey && typeof providerData.apiKey === 'object') {
          const apiKeyObj = providerData.apiKey as PasswordEncryptedPayload;
          if (apiKeyObj.salt) {
            try {
              apiKey = await decryptWithPassword(apiKeyObj, DEFAULT_EXPORT_PASSWORD);
            } catch (error) {
              hadDecryptFailure = true;
              console.warn(`Failed to decrypt provider key for ${providerKey}`, error);
            }
          }
        }

        const models = normalizeModels(providerData.models);

        providerUpdates[providerKey] = {
          enabled: typeof providerData.enabled === 'boolean'
            ? providerData.enabled
            : providers[providerKey].enabled,
          apiKey: apiKey ?? providers[providerKey].apiKey,
          baseUrl: typeof providerData.baseUrl === 'string'
            ? providerData.baseUrl
            : providers[providerKey].baseUrl,
          apiFormat: getEffectiveApiFormat(
            providerKey,
            providerData.apiFormat ?? providers[providerKey].apiFormat,
          ),
          codingPlanEnabled: typeof providerData.codingPlanEnabled === 'boolean'
            ? providerData.codingPlanEnabled
            : (providers[providerKey] as { codingPlanEnabled?: boolean }).codingPlanEnabled,
          models: models ?? providers[providerKey].models,
        };
      }

      if (Object.keys(providerUpdates).length === 0) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      // Check if any key was successfully decrypted
      const anyKeyDecrypted = Object.entries(providerUpdates).some(
        ([key, update]) => update?.apiKey && update.apiKey !== providers[key]?.apiKey,
      );

      if (!anyKeyDecrypted && hadDecryptFailure) {
        setError(i18nService.t('decryptProvidersFailed'));
        return;
      }

      setProviders((prev) => {
        const next = { ...prev };
        Object.entries(providerUpdates).forEach(([providerKey, update]) => {
          next[providerKey] = {
            ...prev[providerKey],
            ...update,
          };
        });
        return next;
      });
      if (hadDecryptFailure) {
        setNoticeMessage(i18nService.t('decryptProvidersPartial'));
      }
    } catch (err) {
      console.error('Failed to import providers:', err);
      const isDecryptError = err instanceof Error
        && (err.message === 'Invalid encrypted payload' || err.name === 'OperationError');
      const message = isDecryptError
        ? i18nService.t('decryptProvidersFailed')
        : i18nService.t('importProvidersFailed');
      setError(message);
    } finally {
      setIsImportingProviders(false);
    }
  }, [providerKeys, providers, getEffectiveApiFormat, setProviders, setError, setNoticeMessage]);

  const handleImportProviders = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setError(null);

    try {
      const raw = await file.text();
      let payload: ProvidersImportPayload;
      try {
        payload = JSON.parse(raw) as ProvidersImportPayload;
      } catch (parseError) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      if (!payload || payload.type !== EXPORT_FORMAT_TYPE || !payload.providers) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      if (payload.version === 2 && payload.encryption?.keySource === 'password') {
        await processImportPayloadWithPassword(payload);
        return;
      }

      if (payload.version === 1) {
        await processImportPayloadWithLocalKey(payload);
        return;
      }

      setError(i18nService.t('invalidProvidersFile'));
    } catch (err) {
      console.error('Failed to import providers:', err);
      setError(i18nService.t('importProvidersFailed'));
    }
  }, [processImportPayloadWithLocalKey, processImportPayloadWithPassword, setError]);

  return {
    isImportingProviders,
    isExportingProviders,
    handleImportProvidersClick,
    handleImportProviders,
    handleExportProviders,
  };
};
