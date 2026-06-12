import { describe, expect, it, vi } from 'vitest';

vi.mock('../scheduled-task/enginePrompt', () => ({
  buildScheduledTaskEnginePrompt: vi.fn((engine: string) => `prompt:${engine}`),
}));

import {
  getEngineNotReadyResponse,
  isExternalAgentProviderAppType,
  mergeCoworkSystemPrompt,
} from './mainBootstrapIpcRuntimeHelperSupport';

describe('mainBootstrapIpcRuntimeHelperSupport', () => {
  it('builds engine-not-ready response with fallback message', () => {
    expect(getEngineNotReadyResponse({})).toEqual({
      success: false,
      code: 'ENGINE_NOT_READY',
      error: 'AI engine is initializing. Please try again in a moment.',
      engineStatus: {},
    });
  });

  it('validates external agent provider app types', () => {
    expect(isExternalAgentProviderAppType('claude')).toBe(true);
    expect(isExternalAgentProviderAppType('deepseek_tui')).toBe(true);
    expect(isExternalAgentProviderAppType('invalid')).toBe(false);
  });

  it('merges scheduled task prompt with trimmed system prompt', () => {
    expect(
      mergeCoworkSystemPrompt('openclaw' as never, '  custom prompt  '),
    ).toBe('prompt:openclaw\n\ncustom prompt');
  });
});
