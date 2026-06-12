import { describe, expect, it } from 'vitest';

import { DeepSeekTuiRuntimeAdapter } from '../main/libs/agentEngine/deepSeekTuiRuntimeAdapter';
import { ExternalCliRuntimeAdapter } from '../main/libs/agentEngine/externalCliRuntimeAdapter';
import { HermesRuntimeAdapter } from '../main/libs/agentEngine/hermesRuntimeAdapter';
import { OpenClawRuntimeAdapter } from '../main/libs/agentEngine/openclawRuntimeAdapter';
import { ClaudeCodeAdapter } from './claude-code/ClaudeCodeAdapter';
import { CodexAdapter } from './codex/CodexAdapter';
import { DeepSeekTuiAdapter } from './deepseek-tui/DeepSeekTuiAdapter';
import { HermesAdapter } from './hermes/HermesAdapter';
import {
  ClaudeCodeAdapter as BarrelClaudeCodeAdapter,
  CodexAdapter as BarrelCodexAdapter,
  DeepSeekTuiAdapter as BarrelDeepSeekTuiAdapter,
  HermesAdapter as BarrelHermesAdapter,
  OpenClawAdapter as BarrelOpenClawAdapter,
  OpenCodeAdapter as BarrelOpenCodeAdapter,
} from './index';
import { OpenClawAdapter } from './openclaw/OpenClawAdapter';
import { OpenCodeAdapter } from './opencode/OpenCodeAdapter';

describe('engines facade exports', () => {
  it('keeps the barrel exports aligned with the documented facade classes', () => {
    expect(BarrelOpenCodeAdapter).toBe(OpenCodeAdapter);
    expect(BarrelOpenClawAdapter).toBe(OpenClawAdapter);
    expect(BarrelClaudeCodeAdapter).toBe(ClaudeCodeAdapter);
    expect(BarrelHermesAdapter).toBe(HermesAdapter);
    expect(BarrelDeepSeekTuiAdapter).toBe(DeepSeekTuiAdapter);
    expect(BarrelCodexAdapter).toBe(CodexAdapter);
  });

  it('bridges each facade to a concrete runtime implementation', () => {
    expect(Object.getPrototypeOf(OpenCodeAdapter.prototype)).toBe(ExternalCliRuntimeAdapter.prototype);
    expect(Object.getPrototypeOf(ClaudeCodeAdapter.prototype)).toBe(ExternalCliRuntimeAdapter.prototype);
    expect(Object.getPrototypeOf(CodexAdapter.prototype)).toBe(ExternalCliRuntimeAdapter.prototype);
    expect(Object.getPrototypeOf(OpenClawAdapter.prototype)).toBe(OpenClawRuntimeAdapter.prototype);
    expect(Object.getPrototypeOf(HermesAdapter.prototype)).toBe(HermesRuntimeAdapter.prototype);
    expect(Object.getPrototypeOf(DeepSeekTuiAdapter.prototype)).toBe(DeepSeekTuiRuntimeAdapter.prototype);
  });
});
