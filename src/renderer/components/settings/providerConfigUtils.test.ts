import { describe, expect, it } from 'vitest';

import {
  buildOpenAICompatibleChatCompletionsUrl,
  buildOpenAIResponsesUrl,
  getDefaultActiveProvider,
  getEffectiveApiFormat,
  normalizeApiFormat,
  providerRequiresApiKey,
  resolveBaseUrl,
  shouldUseMaxCompletionTokensForOpenAI,
  shouldUseOpenAIResponsesForProvider,
} from './providerConfigUtils';

describe('providerConfigUtils', () => {
  it('normalizes fixed provider API formats', () => {
    expect(normalizeApiFormat('unexpected')).toBe('anthropic');
    expect(getEffectiveApiFormat('moonshot', 'anthropic')).toBe('openai');
    expect(getEffectiveApiFormat('anthropic', 'openai')).toBe('anthropic');
    expect(getEffectiveApiFormat('gemini', 'openai')).toBe('gemini');
  });

  it('builds OpenAI-compatible endpoint URLs for common provider shapes', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('', 'openai')).toBe(
      '/v1/chat/completions',
    );
    expect(
      buildOpenAICompatibleChatCompletionsUrl(
        'https://api.openai.com/v1',
        'openai',
      ),
    ).toBe('https://api.openai.com/v1/chat/completions');
    expect(
      buildOpenAICompatibleChatCompletionsUrl(
        'https://generativelanguage.googleapis.com/v1beta',
        'gemini',
      ),
    ).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(buildOpenAIResponsesUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/responses',
    );
  });

  it('selects OpenAI-specific token knobs only where expected', () => {
    expect(shouldUseOpenAIResponsesForProvider('openai')).toBe(true);
    expect(shouldUseOpenAIResponsesForProvider('deepseek')).toBe(false);
    expect(shouldUseMaxCompletionTokensForOpenAI('openai', 'gpt-5-mini')).toBe(
      true,
    );
    expect(shouldUseMaxCompletionTokensForOpenAI('openai', 'gpt-4o')).toBe(
      false,
    );
    expect(shouldUseMaxCompletionTokensForOpenAI('anthropic', 'gpt-5')).toBe(
      false,
    );
  });

  it('keeps provider auth and default selection behavior stable', () => {
    expect(providerRequiresApiKey('openai')).toBe(true);
    expect(providerRequiresApiKey('ollama')).toBe(false);
    expect(resolveBaseUrl('openai', '', 'openai')).toContain('openai');
    expect(getDefaultActiveProvider()).toBeTruthy();
  });
});
