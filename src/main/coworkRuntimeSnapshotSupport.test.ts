import { describe, expect, it } from 'vitest';

import {
  getApiOverrideFromRuntimeSnapshot,
  getClaudeCodePermissionLabel,
  getConfigSourceForEngine,
  getEngineSnapshotLabel,
  getExternalProviderAppTypeForEngine,
} from './coworkRuntimeSnapshotSupport';

describe('coworkRuntimeSnapshotSupport', () => {
  it('maps engines to external provider app types and snapshot labels', () => {
    expect(getExternalProviderAppTypeForEngine('claude_code')).toBe('claude');
    expect(getExternalProviderAppTypeForEngine('codex')).toBe('codex');
    expect(getExternalProviderAppTypeForEngine('hermes')).toBe('hermes');
    expect(getExternalProviderAppTypeForEngine('opencode')).toBe('opencode');
    expect(getExternalProviderAppTypeForEngine('deepseek_tui')).toBe(
      'deepseek_tui',
    );
    expect(getExternalProviderAppTypeForEngine('openclaw')).toBeNull();

    expect(getEngineSnapshotLabel('openclaw')).toBe('OpenClaw');
    expect(getEngineSnapshotLabel('hermes')).toBe('Hermes Agent');
    expect(getEngineSnapshotLabel('claude_code')).toBe('Claude Code');
    expect(getEngineSnapshotLabel('codex')).toBe('Codex CLI');
    expect(getEngineSnapshotLabel('opencode')).toBe('OpenCode');
    expect(getEngineSnapshotLabel('deepseek_tui')).toBe('DeepSeek-TUI');
  });

  it('maps Claude Code permission labels and engine config sources', () => {
    expect(getClaudeCodePermissionLabel('bypassPermissions')).toBe(
      'Auto Execute',
    );
    expect(getClaudeCodePermissionLabel('default')).toBe('Default');
    expect(getClaudeCodePermissionLabel('plan')).toBe('Plan');
    expect(getClaudeCodePermissionLabel('acceptEdits')).toBe('Accept Edits');
    expect(getClaudeCodePermissionLabel('unknown')).toBeNull();

    const config = {
      claudeCodeConfigSource: 'local_cli',
      codexConfigSource: 'agora_model',
      hermesConfigSource: 'local_cli',
      opencodeConfigSource: 'agora_model',
      deepseekTuiConfigSource: 'local_cli',
    };
    expect(getConfigSourceForEngine('claude_code', config)).toBe('local_cli');
    expect(getConfigSourceForEngine('codex', config)).toBe('agora_model');
    expect(getConfigSourceForEngine('hermes', config)).toBe('local_cli');
    expect(getConfigSourceForEngine('opencode', config)).toBe('agora_model');
    expect(getConfigSourceForEngine('deepseek_tui', config)).toBe('local_cli');
    expect(getConfigSourceForEngine('openclaw', config)).toBe('agora_model');
  });

  it('derives API override payloads only for Agora-model snapshots with model identity', () => {
    expect(getApiOverrideFromRuntimeSnapshot()).toBeUndefined();
    expect(
      getApiOverrideFromRuntimeSnapshot({
        agentEngine: 'claude_code',
        engineLabel: 'Claude Code',
        providerKey: 'provider-1',
        providerName: 'Provider One',
        modelId: 'model-1',
        modelName: 'Model One',
        modelLabel: 'Provider One · Model One',
        configSource: 'local_cli',
        capturedAt: 1000,
      }),
    ).toBeUndefined();

    expect(
      getApiOverrideFromRuntimeSnapshot({
        agentEngine: 'openclaw',
        engineLabel: 'OpenClaw',
        providerKey: 'provider-1',
        providerName: 'Provider One',
        modelId: 'model-1',
        modelName: 'Model One',
        modelLabel: 'Provider One · Model One',
        configSource: 'agora_model',
        capturedAt: 1000,
      }),
    ).toEqual({
      modelId: 'model-1',
      providerName: 'provider-1',
    });
  });
});
