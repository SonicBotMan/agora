import { describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';
import {
  FeishuEngineKey,
  FeishuManagementMode,
  FeishuRuntimeOwnership,
} from '../shared/im/constants';
import { createIMGatewayFeishuSupport } from './imGatewayRuntimeFeishuSupport';

function createDeps(options: {
  engine?: string;
  managementMode?: unknown;
  ownershipByEngine?: Record<string, string>;
  throwOnStoreAccess?: boolean;
  openClawStatus?: { phase: string; message?: string };
  hermesStatus?: { phase: string; message?: string };
} = {}) {
  const imStore = {
    getFeishuManagementMode: vi
      .fn()
      .mockReturnValue(
        options.managementMode ?? FeishuManagementMode.AgoraManaged,
      ),
    getFeishuRuntimeOwnership: vi
      .fn()
      .mockImplementation((engineKey: string) => (
        options.ownershipByEngine?.[engineKey]
        ?? FeishuRuntimeOwnership.AgoraManaged
      )),
  };
  const imGatewayManager = {
    getIMStore: vi.fn(() => {
      if (options.throwOnStoreAccess) {
        throw new Error('store-unavailable');
      }
      return imStore;
    }),
  };
  const deps = {
    getIMGatewayManager: vi.fn().mockReturnValue(imGatewayManager),
    resolveCoworkAgentEngine: vi
      .fn()
      .mockReturnValue(options.engine ?? CoworkAgentEngine.OpenClaw),
    ensureOpenClawRunningForCowork: vi.fn().mockResolvedValue(
      options.openClawStatus ?? {
        phase: 'running',
      },
    ),
    ensureHermesRunningForCowork: vi.fn().mockResolvedValue(
      options.hermesStatus ?? {
        phase: 'running',
      },
    ),
  };

  return {
    deps,
    imStore,
  };
}

describe('imGatewayRuntimeFeishuSupport', () => {
  it('resolves supported Feishu engines and engine keys from the current cowork engine', () => {
    const openClaw = createIMGatewayFeishuSupport(
      createDeps({
        engine: CoworkAgentEngine.OpenClaw,
      }).deps as never,
    );
    const hermes = createIMGatewayFeishuSupport(
      createDeps({
        engine: CoworkAgentEngine.Hermes,
      }).deps as never,
    );
    const claude = createIMGatewayFeishuSupport(
      createDeps({
        engine: CoworkAgentEngine.ClaudeCode,
      }).deps as never,
    );
    const codex = createIMGatewayFeishuSupport(
      createDeps({
        engine: CoworkAgentEngine.Codex,
      }).deps as never,
    );
    const unsupported = createIMGatewayFeishuSupport(
      createDeps({
        engine: CoworkAgentEngine.OpenCode,
      }).deps as never,
    );

    expect(openClaw.resolveFeishuIMAgentEngine()).toBe(
      CoworkAgentEngine.OpenClaw,
    );
    expect(openClaw.resolveFeishuEngineKey()).toBe(FeishuEngineKey.OpenClaw);
    expect(hermes.resolveFeishuEngineKey()).toBe(FeishuEngineKey.Hermes);
    expect(claude.resolveFeishuEngineKey()).toBe(FeishuEngineKey.ClaudeCode);
    expect(codex.resolveFeishuEngineKey()).toBe(FeishuEngineKey.Codex);
    expect(unsupported.resolveFeishuIMAgentEngine()).toBeNull();
    expect(unsupported.resolveFeishuEngineKey()).toBe(FeishuEngineKey.OpenClaw);
    expect(unsupported.normalizeFeishuEngineKey('invalid-key')).toBe(
      FeishuEngineKey.OpenClaw,
    );
    expect(unsupported.normalizeFeishuEngineKey(FeishuEngineKey.Hermes)).toBe(
      FeishuEngineKey.Hermes,
    );
  });

  it('falls back to safe defaults when IM store values are invalid or unavailable', () => {
    const invalidMode = createIMGatewayFeishuSupport(
      createDeps({
        managementMode: 'invalid-mode',
        ownershipByEngine: {
          [FeishuEngineKey.OpenClaw]: FeishuRuntimeOwnership.LocalRuntime,
          [FeishuEngineKey.Hermes]: FeishuRuntimeOwnership.AgoraManaged,
        },
      }).deps as never,
    );
    const unavailableStore = createIMGatewayFeishuSupport(
      createDeps({
        throwOnStoreAccess: true,
      }).deps as never,
    );

    expect(invalidMode.getFeishuManagementMode()).toBe(
      FeishuManagementMode.LocalOpenClaw,
    );
    expect(
      invalidMode.getFeishuRuntimeOwnership(FeishuEngineKey.OpenClaw),
    ).toBe(FeishuRuntimeOwnership.LocalRuntime);
    expect(
      invalidMode.isFeishuEngineManagedByAgora(FeishuEngineKey.Hermes),
    ).toBe(true);

    expect(unavailableStore.getFeishuManagementMode()).toBe(
      FeishuManagementMode.LocalOpenClaw,
    );
    expect(
      unavailableStore.getFeishuRuntimeOwnership(FeishuEngineKey.OpenClaw),
    ).toBe(FeishuRuntimeOwnership.LocalRuntime);
    expect(
      unavailableStore.getFeishuRuntimeOwnership(FeishuEngineKey.Codex),
    ).toBe(FeishuRuntimeOwnership.AgoraManaged);
  });

  it('ensures OpenClaw and Hermes are running before Feishu cowork work proceeds', async () => {
    const openClawDeps = createDeps({
      engine: CoworkAgentEngine.OpenClaw,
      openClawStatus: {
        phase: 'starting',
        message: 'openclaw starting',
      },
    });
    const hermesDeps = createDeps({
      engine: CoworkAgentEngine.Hermes,
      hermesStatus: {
        phase: 'error',
      },
    });
    const codexDeps = createDeps({
      engine: CoworkAgentEngine.Codex,
    });

    const openClaw = createIMGatewayFeishuSupport(openClawDeps.deps as never);
    const hermes = createIMGatewayFeishuSupport(hermesDeps.deps as never);
    const codex = createIMGatewayFeishuSupport(codexDeps.deps as never);

    await expect(openClaw.ensureCoworkReady()).rejects.toThrow(
      'openclaw starting',
    );
    expect(openClawDeps.deps.ensureOpenClawRunningForCowork).toHaveBeenCalledTimes(
      1,
    );

    await expect(hermes.ensureCoworkReady()).rejects.toThrow(
      'AI engine is initializing. Please try again in a moment.',
    );
    expect(hermesDeps.deps.ensureHermesRunningForCowork).toHaveBeenCalledTimes(1);

    await expect(codex.ensureCoworkReady()).resolves.toBeUndefined();
    expect(codexDeps.deps.ensureOpenClawRunningForCowork).not.toHaveBeenCalled();
    expect(codexDeps.deps.ensureHermesRunningForCowork).not.toHaveBeenCalled();
  });
});
