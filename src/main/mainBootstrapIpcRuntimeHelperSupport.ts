import { buildScheduledTaskEnginePrompt } from '../scheduled-task/enginePrompt';
import type { CoworkAgentEngine } from '../shared/cowork/constants';
import type { ExternalAgentProviderAppType } from './libs/externalAgentProviderStore';

const ENGINE_NOT_READY_CODE = 'ENGINE_NOT_READY';

export function getEngineNotReadyResponse(status: { message?: string }) {
  const fallbackMessage =
    'AI engine is initializing. Please try again in a moment.';
  return {
    success: false,
    code: ENGINE_NOT_READY_CODE,
    error: status.message || fallbackMessage,
    engineStatus: status,
  };
}

export function isExternalAgentProviderAppType(
  value: unknown,
): value is ExternalAgentProviderAppType {
  return (
    value === 'claude'
    || value === 'codex'
    || value === 'hermes'
    || value === 'openclaw'
    || value === 'opencode'
    || value === 'grok'
    || value === 'qwen'
    || value === 'deepseek_tui'
  );
}

export function mergeCoworkSystemPrompt(
  engine: CoworkAgentEngine,
  systemPrompt?: string,
): string | undefined {
  const sections = [
    buildScheduledTaskEnginePrompt(engine),
    systemPrompt?.trim() || '',
  ].filter(Boolean);
  return sections.length > 0 ? sections.join('\n\n') : undefined;
}
