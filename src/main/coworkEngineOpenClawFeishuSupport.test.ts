import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';
import {
  FeishuRuntimeOwnership,
} from '../shared/im/constants';

const openClawFeishuSupportTestState = vi.hoisted(() => {
  const detectOpenClawLocalFeishuConfig = vi.fn();

  return {
    detectOpenClawLocalFeishuConfig,
  };
});

vi.mock('./libs/openclawSystemRuntime', () => ({
  detectOpenClawLocalFeishuConfig:
    openClawFeishuSupportTestState.detectOpenClawLocalFeishuConfig,
}));

import { createOpenClawConfigFeishuSupport } from './coworkEngineOpenClawFeishuSupport';

function createDeps(options: {
  ownership?: string;
  engine?: string;
  localStatus?: { feishuConfigured?: boolean; feishuRunning?: boolean };
} = {}) {
  const deps = {
    getFeishuRuntimeOwnership: vi
      .fn()
      .mockReturnValue(
        options.ownership ?? FeishuRuntimeOwnership.AgoraManaged,
      ),
    resolveFeishuIMAgentEngine: vi
      .fn()
      .mockReturnValue(options.engine ?? CoworkAgentEngine.OpenClaw),
    getOpenClawEngineManager: vi.fn().mockReturnValue({
      getLocalChannelStatus: vi.fn().mockReturnValue(
        options.localStatus ?? {
          feishuConfigured: false,
          feishuRunning: false,
        },
      ),
    }),
  };

  return { deps };
}

describe('coworkEngineOpenClawFeishuSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats OpenClaw Feishu as managed only when Agora owns the runtime and OpenClaw is the active Feishu engine', () => {
    openClawFeishuSupportTestState.detectOpenClawLocalFeishuConfig.mockReturnValue(
      {
        configured: false,
        enabled: false,
      },
    );
    const managed = createOpenClawConfigFeishuSupport(
      createDeps({
        ownership: FeishuRuntimeOwnership.AgoraManaged,
        engine: CoworkAgentEngine.OpenClaw,
      }).deps as never,
    );
    const delegated = createOpenClawConfigFeishuSupport(
      createDeps({
        ownership: FeishuRuntimeOwnership.AgoraManaged,
        engine: CoworkAgentEngine.Hermes,
      }).deps as never,
    );
    const localRuntime = createOpenClawConfigFeishuSupport(
      createDeps({
        ownership: FeishuRuntimeOwnership.LocalRuntime,
        engine: CoworkAgentEngine.OpenClaw,
      }).deps as never,
    );

    expect(managed.shouldWriteOpenClawFeishuChannel()).toBe(true);
    expect(managed.isFeishuManagedByOpenClawConfig()).toBe(true);
    expect(delegated.shouldWriteOpenClawFeishuChannel()).toBe(true);
    expect(delegated.isFeishuManagedByOpenClawConfig()).toBe(false);
    expect(localRuntime.shouldWriteOpenClawFeishuChannel()).toBe(false);
    expect(localRuntime.isFeishuManagedByOpenClawConfig()).toBe(false);
  });

  it('merges local config detection with live channel status and reports whether any local Feishu setup exists', () => {
    openClawFeishuSupportTestState.detectOpenClawLocalFeishuConfig.mockReturnValue(
      {
        configured: false,
        enabled: false,
        configPath: '/tmp/openclaw.json',
      },
    );
    const support = createOpenClawConfigFeishuSupport(
      createDeps({
        localStatus: {
          feishuConfigured: true,
          feishuRunning: true,
        },
      }).deps as never,
    );

    expect(support.detectLocalOpenClawFeishu()).toEqual({
      configured: true,
      enabled: true,
      configPath: '/tmp/openclaw.json',
    });
    expect(support.hasLocalOpenClawFeishuConfigured()).toBe(true);
  });

  it('returns false for local Feishu presence when both config detection and runtime status are empty', () => {
    openClawFeishuSupportTestState.detectOpenClawLocalFeishuConfig.mockReturnValue(
      {
        configured: false,
        enabled: false,
      },
    );
    const support = createOpenClawConfigFeishuSupport(
      createDeps({
        localStatus: {
          feishuConfigured: false,
          feishuRunning: false,
        },
      }).deps as never,
    );

    expect(support.hasLocalOpenClawFeishuConfigured()).toBe(false);
    expect(
      support.detectLocalOpenClawFeishu(),
    ).toEqual({
      configured: false,
      enabled: false,
    });
  });
});
