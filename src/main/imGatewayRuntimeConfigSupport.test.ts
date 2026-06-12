import { describe, expect, it, vi } from 'vitest';

import { buildLLMConfigFromStore } from './imGatewayRuntimeConfigSupport';

describe('imGatewayRuntimeConfigSupport', () => {
  it('prefers the first enabled provider with an API key and returns provider-specific config', () => {
    const store = {
      get: vi.fn().mockReturnValue({
        providers: {
          disabled: {
            enabled: false,
            apiKey: 'sk-disabled',
          },
          openrouter: {
            enabled: true,
            apiKey: 'sk-openrouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            models: [{ id: 'openrouter/model-1' }],
          },
          fallback: {
            enabled: true,
            apiKey: 'sk-fallback',
            models: [{ id: 'fallback/model' }],
          },
        },
      }),
    };

    expect(buildLLMConfigFromStore(store as never)).toEqual({
      apiKey: 'sk-openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openrouter/model-1',
      provider: 'openrouter',
    });
  });

  it('falls back to legacy api/model config when no enabled provider has credentials', () => {
    const store = {
      get: vi.fn().mockReturnValue({
        providers: {
          openrouter: {
            enabled: true,
          },
        },
        api: {
          key: 'sk-legacy',
          baseUrl: 'https://api.example.com',
        },
        model: {
          defaultModel: 'gpt-4.1',
        },
      }),
    };

    expect(buildLLMConfigFromStore(store as never)).toEqual({
      apiKey: 'sk-legacy',
      baseUrl: 'https://api.example.com',
      model: 'gpt-4.1',
    });
  });

  it('returns null when app config is missing or contains no usable credentials', () => {
    const missingStore = {
      get: vi.fn().mockReturnValue(undefined),
    };
    const emptyStore = {
      get: vi.fn().mockReturnValue({
        providers: {
          openrouter: {
            enabled: true,
          },
        },
      }),
    };

    expect(buildLLMConfigFromStore(missingStore as never)).toBeNull();
    expect(buildLLMConfigFromStore(emptyStore as never)).toBeNull();
  });
});
