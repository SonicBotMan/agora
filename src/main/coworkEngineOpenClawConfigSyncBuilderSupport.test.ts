import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeishuEngineKey } from '../shared/im/constants';

const openClawConfigSyncBuilderTestState = vi.hoisted(() => {
  const instances: Array<{ options: Record<string, unknown> }> = [];

  class MockOpenClawConfigSync {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      instances.push(this);
    }
  }

  return {
    instances,
    MockOpenClawConfigSync,
  };
});

vi.mock('./libs/openclawConfigSync', () => ({
  OpenClawConfigSync: openClawConfigSyncBuilderTestState.MockOpenClawConfigSync,
}));

import { createOpenClawConfigSyncGetter } from './coworkEngineOpenClawConfigSyncBuilderSupport';

function createDeps(options: {
  enterpriseConfig?: unknown;
  throwOnImManager?: boolean;
} = {}) {
  const store = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'enterprise_config') {
        return options.enterpriseConfig;
      }
      return undefined;
    }),
  };
  const coworkStore = {
    getConfig: vi.fn().mockReturnValue({ id: 'cowork-config' }),
    listAgents: vi.fn().mockReturnValue([{ id: 'agent-1' }]),
  };
  const skillManager = {
    listSkills: vi.fn().mockReturnValue([
      { id: 'skill-1', enabled: true, ignored: 'x' },
      { id: 'skill-2', enabled: false, ignored: 'y' },
    ]),
  };
  const imGatewayManager = {
    getConfig: vi.fn().mockReturnValue({
      telegram: { enabled: true },
      wecom: { enabled: true },
      weixin: { enabled: false },
      settings: { allowCommands: true },
      discord: { enabled: true },
    }),
    getIMStore: vi.fn().mockReturnValue({
      getDingTalkInstances: vi.fn().mockReturnValue([{ instanceId: 'ding-1' }]),
      getFeishuInstances: vi.fn().mockReturnValue([{ instanceId: 'feishu-1' }]),
      getQQInstances: vi.fn().mockReturnValue([{ instanceId: 'qq-1' }]),
    }),
  };
  const deps = {
    getOpenClawEngineManager: vi.fn().mockReturnValue({ id: 'manager' }),
    getCoworkStore: vi.fn().mockReturnValue(coworkStore),
    getStore: vi.fn().mockReturnValue(store),
    getSkillManager: vi.fn().mockReturnValue(skillManager),
    getIMGatewayManager: options.throwOnImManager
      ? vi.fn(() => {
        throw new Error('im-manager-unavailable');
      })
      : vi.fn().mockReturnValue(imGatewayManager),
    getMcpBridgeConfig: vi.fn().mockReturnValue({ callbackUrl: 'http://localhost' }),
  };

  return {
    deps,
    store,
    coworkStore,
    skillManager,
    imGatewayManager,
  };
}

describe('coworkEngineOpenClawConfigSyncBuilderSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openClawConfigSyncBuilderTestState.instances.length = 0;
  });

  it('creates a singleton OpenClawConfigSync with mapped store, skills, IM config, MCP, and agents accessors', () => {
    const { deps, skillManager, coworkStore, imGatewayManager } = createDeps({
      enterpriseConfig: { enabled: true },
    });
    const getter = createOpenClawConfigSyncGetter(
      deps as never,
      {
        shouldWriteOpenClawFeishuChannel: vi.fn().mockReturnValue(true),
        isFeishuManagedByOpenClawConfig: vi.fn().mockReturnValue(true),
      },
    );

    const first = getter();
    const second = getter();

    expect(first).toBe(second);
    expect(openClawConfigSyncBuilderTestState.instances).toHaveLength(1);

    const options = openClawConfigSyncBuilderTestState.instances[0]?.options;
    expect(options?.engineManager).toEqual({ id: 'manager' });
    expect(
      (options?.getCoworkConfig as (() => unknown) | undefined)?.(),
    ).toEqual({ id: 'cowork-config' });
    expect(
      (options?.isEnterprise as (() => boolean) | undefined)?.(),
    ).toBe(true);
    expect(
      (options?.getSkillsList as (() => unknown[]) | undefined)?.(),
    ).toEqual([
      { id: 'skill-1', enabled: true },
      { id: 'skill-2', enabled: false },
    ]);
    expect(skillManager.listSkills).toHaveBeenCalledTimes(1);
    expect((options?.getPopoConfig as (() => unknown) | undefined)?.()).toBeNull();
    expect(
      (options?.getNeteaseBeeChanConfig as (() => unknown) | undefined)?.(),
    ).toBeNull();
    expect(
      (options?.getTelegramOpenClawConfig as (() => unknown) | undefined)?.(),
    ).toEqual({ enabled: true });
    expect(
      (options?.getDingTalkInstances as (() => unknown[]) | undefined)?.(),
    ).toEqual([{ instanceId: 'ding-1' }]);
    expect(
      (options?.getFeishuInstances as (() => unknown[]) | undefined)?.(),
    ).toEqual([{ instanceId: 'feishu-1' }]);
    expect(
      imGatewayManager.getIMStore().getFeishuInstances,
    ).toHaveBeenCalledWith(FeishuEngineKey.OpenClaw);
    expect(
      (options?.getQQInstances as (() => unknown[]) | undefined)?.(),
    ).toEqual([{ instanceId: 'qq-1' }]);
    expect(
      (options?.getWecomConfig as (() => unknown) | undefined)?.(),
    ).toEqual({ enabled: true });
    expect(
      (options?.getWeixinConfig as (() => unknown) | undefined)?.(),
    ).toEqual({ enabled: false });
    expect(
      (options?.getIMSettings as (() => unknown) | undefined)?.(),
    ).toEqual({ allowCommands: true });
    expect(
      (options?.getDiscordOpenClawConfig as (() => unknown) | undefined)?.(),
    ).toEqual({ enabled: true });
    expect(
      (options?.getMcpBridgeConfig as (() => unknown) | undefined)?.(),
    ).toEqual({ callbackUrl: 'http://localhost' });
    expect(
      (options?.getAgents as (() => unknown[]) | undefined)?.(),
    ).toEqual([{ id: 'agent-1' }]);
    expect(coworkStore.listAgents).toHaveBeenCalledTimes(1);
  });

  it('falls back safely when IM gateway access is unavailable', () => {
    const { deps } = createDeps({
      throwOnImManager: true,
    });
    const getter = createOpenClawConfigSyncGetter(
      deps as never,
      {
        shouldWriteOpenClawFeishuChannel: vi.fn().mockReturnValue(false),
        isFeishuManagedByOpenClawConfig: vi.fn().mockReturnValue(false),
      },
    );

    getter();
    const options = openClawConfigSyncBuilderTestState.instances[0]?.options;

    expect(
      (options?.getTelegramOpenClawConfig as (() => unknown) | undefined)?.(),
    ).toBeNull();
    expect(
      (options?.getDingTalkInstances as (() => unknown[]) | undefined)?.(),
    ).toEqual([]);
    expect(
      (options?.getFeishuInstances as (() => unknown[]) | undefined)?.(),
    ).toEqual([]);
    expect(
      (options?.getQQInstances as (() => unknown[]) | undefined)?.(),
    ).toEqual([]);
    expect(
      (options?.getWecomConfig as (() => unknown) | undefined)?.(),
    ).toBeNull();
    expect(
      (options?.getWeixinConfig as (() => unknown) | undefined)?.(),
    ).toBeNull();
    expect(
      (options?.getIMSettings as (() => unknown) | undefined)?.(),
    ).toBeNull();
    expect(
      (options?.getDiscordOpenClawConfig as (() => unknown) | undefined)?.(),
    ).toBeNull();
  });
});
