/**
 * Engines module barrel export.
 * Exports all 6 engine adapter classes and shared types.
 */

export { OpenCodeAdapter } from './opencode/OpenCodeAdapter';
export { OpenClawAdapter } from './openclaw/OpenClawAdapter';
export { ClaudeCodeAdapter } from './claude-code/ClaudeCodeAdapter';
export { HermesAdapter } from './hermes/HermesAdapter';
export { DeepSeekTuiAdapter } from './deepseek-tui/DeepSeekTuiAdapter';
export { CodexAdapter } from './codex/CodexAdapter';

export type {
  EngineStatus,
  EngineInfo,
  EngineInstallResult,
} from './types';
