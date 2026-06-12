import {
  ClaudeCodePermissionMode,
  CoworkAgentEngine as CoworkAgentEngineValue,
  ExternalAgentConfigSource,
} from '../shared/cowork/constants';
import type { CoworkSessionRuntimeSnapshot } from '../shared/cowork/runtimeSnapshot';
import type { CoworkAgentEngine } from './libs/agentEngine';
import type { ExternalAgentProviderAppType } from './libs/externalAgentProviderStore';

type CoworkConfigSourceShape = {
  claudeCodeConfigSource?: string | null;
  codexConfigSource?: string | null;
  hermesConfigSource?: string | null;
  opencodeConfigSource?: string | null;
  deepseekTuiConfigSource?: string | null;
};

export function getExternalProviderAppTypeForEngine(
  engine: CoworkAgentEngine,
): ExternalAgentProviderAppType | null {
  if (engine === CoworkAgentEngineValue.ClaudeCode) return 'claude';
  if (engine === CoworkAgentEngineValue.Codex) return 'codex';
  if (engine === CoworkAgentEngineValue.Hermes) return 'hermes';
  if (engine === CoworkAgentEngineValue.OpenCode) return 'opencode';
  if (engine === CoworkAgentEngineValue.DeepSeekTui) return 'deepseek_tui';
  return null;
}

export function getEngineSnapshotLabel(engine: CoworkAgentEngine): string {
  if (engine === CoworkAgentEngineValue.OpenClaw) return 'OpenClaw';
  if (engine === CoworkAgentEngineValue.Hermes) return 'Hermes Agent';
  if (engine === CoworkAgentEngineValue.ClaudeCode) return 'Claude Code';
  if (engine === CoworkAgentEngineValue.Codex) return 'Codex CLI';
  if (engine === CoworkAgentEngineValue.OpenCode) return 'OpenCode';
  if (engine === CoworkAgentEngineValue.DeepSeekTui) return 'DeepSeek-TUI';
  return 'Cowork';
}

export function getClaudeCodePermissionLabel(
  mode: string | null | undefined,
): string | null {
  if (mode === ClaudeCodePermissionMode.BypassPermissions) {
    return 'Auto Execute';
  }
  if (mode === ClaudeCodePermissionMode.Default) return 'Default';
  if (mode === ClaudeCodePermissionMode.Plan) return 'Plan';
  if (mode === ClaudeCodePermissionMode.AcceptEdits) return 'Accept Edits';
  return null;
}

export function getConfigSourceForEngine(
  engine: CoworkAgentEngine,
  config: CoworkConfigSourceShape,
): string | null {
  if (engine === CoworkAgentEngineValue.ClaudeCode) {
    return config.claudeCodeConfigSource ?? null;
  }
  if (engine === CoworkAgentEngineValue.Codex) {
    return config.codexConfigSource ?? null;
  }
  if (engine === CoworkAgentEngineValue.Hermes) {
    return config.hermesConfigSource ?? null;
  }
  if (engine === CoworkAgentEngineValue.OpenCode) {
    return config.opencodeConfigSource ?? null;
  }
  if (engine === CoworkAgentEngineValue.DeepSeekTui) {
    return config.deepseekTuiConfigSource ?? null;
  }
  return ExternalAgentConfigSource.AgoraModel;
}

export function getApiOverrideFromRuntimeSnapshot(
  snapshot?: CoworkSessionRuntimeSnapshot | null,
): { modelId?: string | null; providerName?: string | null } | undefined {
  if (!snapshot || snapshot.configSource === ExternalAgentConfigSource.LocalCli) {
    return undefined;
  }
  if (!snapshot.modelId && !snapshot.providerKey && !snapshot.providerName) {
    return undefined;
  }
  return {
    modelId: snapshot.modelId,
    providerName: snapshot.providerKey || snapshot.providerName,
  };
}
