import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';
import { FeishuEngineKey } from '../shared/im/constants';

const imGatewayManagerTestState = vi.hoisted(() => {
  const managerInstances: unknown[] = [];
  const buildLLMConfigFromStore = vi.fn();

  class MockIMGatewayManager {
    db: unknown;
    options: Record<string, unknown>;
    listeners: Map<string, Array<(...args: unknown[]) => void>>;
    initialize: ReturnType<typeof vi.fn>;
    getIMStore: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;

    constructor(db: unknown, options?: Record<string, unknown>) {
      this.db = db;
      this.options = options ?? {};
      this.listeners = new Map();
      this.initialize = vi.fn();
      this.getIMStore = vi.fn().mockReturnValue({
        migrateLegacyFeishuInstances: vi.fn(),
      });
      this.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const current = this.listeners.get(event) ?? [];
        current.push(listener);
        this.listeners.set(event, current);
        return this;
      });
      managerInstances.push(this);
    }

    emitMock(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }
  }

  return {
    managerInstances,
    buildLLMConfigFromStore,
    MockIMGatewayManager,
  };
});

vi.mock('./im', () => ({
  IMGatewayManager: imGatewayManagerTestState.MockIMGatewayManager,
}));

vi.mock('./imGatewayRuntimeConfigSupport', () => ({
  buildLLMConfigFromStore: imGatewayManagerTestState.buildLLMConfigFromStore,
}));

import { createIMGatewayManager } from './imGatewayRuntimeManagerSupport';

function createDeps(options: {
  agentEngine?: CoworkAgentEngine;
  hasLocalOpenClawFeishuConfigured?: boolean;
  hermesSyncResult?: { success: boolean; error?: string };
  hermesStatus?: { phase: string; message?: string };
  openClawRuntimeAdapter?: {
    connectGatewayIfNeeded: ReturnType<typeof vi.fn>;
    ensureReady: ReturnType<typeof vi.fn>;
    getGatewayClient: ReturnType<typeof vi.fn>;
    getSessionKeysForSession: ReturnType<typeof vi.fn>;
  } | null;
} = {}) {
  const activeSend = vi.fn();
  const destroyedSend = vi.fn();
  const sqliteStore = {
    getDatabase: vi.fn().mockReturnValue('db'),
  };
  const skillManager = {
    buildAutoRoutingPrompt: vi.fn().mockResolvedValue('skills-prompt'),
  };
  const agentTeamRunner = {
    run: vi.fn().mockResolvedValue(undefined),
  };
  const hermesSyncResult = options.hermesSyncResult ?? { success: true };
  const openClawRuntimeAdapter = options.openClawRuntimeAdapter === undefined
    ? {
        connectGatewayIfNeeded: vi.fn().mockResolvedValue(undefined),
        ensureReady: vi.fn().mockResolvedValue(undefined),
        getGatewayClient: vi.fn().mockReturnValue('gateway-client'),
        getSessionKeysForSession: vi.fn().mockReturnValue(['key-1']),
      }
    : options.openClawRuntimeAdapter;
  const deps = {
    getWindows: () => [
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: activeSend },
      } as never,
      {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: destroyedSend },
      } as never,
    ],
    getStore: () => sqliteStore as never,
    getCoworkStore: vi.fn().mockReturnValue({ id: 'cowork-store' }),
    getCoworkEngineRouter: vi.fn().mockReturnValue({ id: 'runtime' }),
    getSkillManager: vi.fn().mockReturnValue(skillManager),
    getAgentTeamRunner: vi.fn().mockReturnValue(agentTeamRunner),
    getWindowsForAssert: () => ({ activeSend, destroyedSend }),
    getCronJobService: vi.fn(),
    resolveCoworkAgentEngine: vi
      .fn()
      .mockReturnValue(options.agentEngine ?? CoworkAgentEngine.OpenClaw),
    ensureOpenClawRunningForCowork: vi.fn(),
    ensureHermesRunningForCowork: vi.fn().mockResolvedValue(
      options.hermesStatus ?? { phase: 'running' },
    ),
    getFeishuRuntimeOwnershipStatus: vi.fn(),
    detectLocalOpenClawFeishu: vi.fn(),
    hasLocalOpenClawFeishuConfigured: vi
      .fn()
      .mockReturnValue(options.hasLocalOpenClawFeishuConfigured ?? false),
    syncOpenClawConfig: vi.fn().mockResolvedValue(undefined),
    getHermesConfigSync: vi.fn().mockReturnValue({
      sync: vi.fn().mockReturnValue(hermesSyncResult),
    }),
    peekOpenClawRuntimeAdapter: vi
      .fn()
      .mockReturnValue(openClawRuntimeAdapter),
    startHermesIMSessionSyncPolling: vi.fn(),
    syncHermesIMSessionsToCowork: vi.fn().mockResolvedValue(undefined),
  };
  const support = {
    ensureCoworkReady: vi.fn().mockResolvedValue(undefined),
    resolveFeishuIMAgentEngine: vi
      .fn()
      .mockReturnValue(CoworkAgentEngine.Hermes),
    resolveFeishuEngineKey: vi.fn().mockReturnValue(FeishuEngineKey.Hermes),
    getFeishuManagementMode: vi.fn().mockReturnValue('agora'),
    getFeishuRuntimeOwnership: vi.fn().mockReturnValue('agora'),
  };
  const createScheduledTask = vi.fn();

  return {
    deps,
    support,
    createScheduledTask,
    sqliteStore,
    skillManager,
    agentTeamRunner,
    activeSend,
    destroyedSend,
  };
}

describe('imGatewayRuntimeManagerSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imGatewayManagerTestState.managerInstances.length = 0;
    imGatewayManagerTestState.buildLLMConfigFromStore.mockReset();
    imGatewayManagerTestState.buildLLMConfigFromStore.mockReturnValue({
      apiKey: 'sk-test',
    });
  });

  it('wires manager options, initialize callbacks, event forwarding, and migration', async () => {
    const {
      deps,
      support,
      createScheduledTask,
      sqliteStore,
      skillManager,
      agentTeamRunner,
      activeSend,
      destroyedSend,
    } = createDeps();

    const manager = createIMGatewayManager({
      deps: deps as never,
      support: support as never,
      createScheduledTask,
    }) as never as InstanceType<
      typeof imGatewayManagerTestState.MockIMGatewayManager
    >;

    expect(imGatewayManagerTestState.managerInstances).toHaveLength(1);
    expect(manager.db).toBe('db');
    expect(manager.getIMStore().migrateLegacyFeishuInstances).toHaveBeenCalledWith(
      FeishuEngineKey.Hermes,
    );

    const initializeArgs = manager.initialize.mock.calls[0]?.[0] as {
      getLLMConfig: () => Promise<unknown>;
      getSkillsPrompt: () => Promise<string | null>;
    };
    await expect(initializeArgs.getLLMConfig()).resolves.toEqual({
      apiKey: 'sk-test',
    });
    await expect(initializeArgs.getSkillsPrompt()).resolves.toBe('skills-prompt');
    expect(imGatewayManagerTestState.buildLLMConfigFromStore).toHaveBeenCalledWith(
      sqliteStore,
    );
    expect(skillManager.buildAutoRoutingPrompt).toHaveBeenCalledTimes(1);

    const managerOptions = manager.options as Record<string, unknown>;
    expect((managerOptions.isOpenClawEngine as () => boolean)()).toBe(true);
    expect((managerOptions.getFeishuAgentEngine as () => unknown)()).toBe(
      CoworkAgentEngine.Hermes,
    );
    expect((managerOptions.getFeishuManagementMode as () => unknown)()).toBe(
      'agora',
    );
    expect(
      (
        managerOptions.getFeishuRuntimeOwnership as (
          engineKey: string,
        ) => string
      )(FeishuEngineKey.Hermes),
    ).toBe('agora');
    expect((managerOptions.hasLocalOpenClawFeishuEnabled as () => boolean)()).toBe(
      false,
    );

    await (managerOptions.syncOpenClawConfig as () => Promise<void>)();
    expect(deps.syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'im-gateway-start',
    });

    await expect(
      (managerOptions.syncHermesConfig as () => Promise<void>)(),
    ).resolves.toBeUndefined();

    await (managerOptions.ensureOpenClawGatewayConnected as () => Promise<void>)();
    expect(
      deps.peekOpenClawRuntimeAdapter()?.connectGatewayIfNeeded,
    ).toHaveBeenCalledTimes(1);

    await (managerOptions.ensureOpenClawGatewayReady as () => Promise<void>)();
    expect(deps.peekOpenClawRuntimeAdapter()?.ensureReady).toHaveBeenCalledTimes(
      1,
    );
    expect(
      deps.peekOpenClawRuntimeAdapter()?.connectGatewayIfNeeded,
    ).toHaveBeenCalledTimes(2);
    expect(
      (managerOptions.getOpenClawGatewayClient as () => unknown)(),
    ).toBe('gateway-client');
    expect(
      (
        managerOptions.getOpenClawSessionKeysForCoworkSession as (
          sessionId: string,
        ) => string[]
      )('session-1'),
    ).toEqual(['key-1']);

    await (managerOptions.ensureHermesGatewayReady as () => Promise<void>)();
    expect(deps.ensureHermesRunningForCowork).toHaveBeenCalledTimes(1);
    expect(deps.startHermesIMSessionSyncPolling).toHaveBeenCalledTimes(1);
    expect(deps.syncHermesIMSessionsToCowork).toHaveBeenCalledWith(
      'gateway-ready',
    );

    await (
      managerOptions.runTeamSession as (input: {
        teamId: string;
        parentSessionId: string;
        prompt: string;
        runtimeSource: string;
      }) => Promise<void>
    )({
      teamId: 'team-1',
      parentSessionId: 'session-1',
      prompt: 'hello',
      runtimeSource: 'im',
    });
    expect(agentTeamRunner.run).toHaveBeenCalledWith({
      teamId: 'team-1',
      parentSessionId: 'session-1',
      prompt: 'hello',
      runtimeSource: 'im',
    });
    expect(managerOptions.createScheduledTask).toBe(createScheduledTask);

    manager.emitMock('statusChange', { connected: true });
    expect(activeSend).toHaveBeenCalledWith('im:status:change', {
      connected: true,
    });
    manager.emitMock('message', { platform: 'feishu', text: 'hi' });
    expect(activeSend).toHaveBeenCalledWith('im:message:received', {
      platform: 'feishu',
      text: 'hi',
    });
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it('chooses the local OpenClaw migration target and surfaces Hermes/OpenClaw readiness failures', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const {
      deps,
      support,
      createScheduledTask,
    } = createDeps({
      hasLocalOpenClawFeishuConfigured: true,
      hermesSyncResult: {
        success: false,
        error: 'bad hermes sync',
      },
      hermesStatus: {
        phase: 'starting',
        message: 'Hermes still booting',
      },
      openClawRuntimeAdapter: null,
    });

    const manager = createIMGatewayManager({
      deps: deps as never,
      support: support as never,
      createScheduledTask,
    }) as never as InstanceType<
      typeof imGatewayManagerTestState.MockIMGatewayManager
    >;

    expect(manager.getIMStore().migrateLegacyFeishuInstances).toHaveBeenCalledWith(
      FeishuEngineKey.OpenClaw,
    );

    const managerOptions = manager.options as Record<string, unknown>;

    await expect(
      (managerOptions.syncHermesConfig as () => Promise<void>)(),
    ).rejects.toThrow('bad hermes sync');

    await expect(
      (managerOptions.ensureHermesGatewayReady as () => Promise<void>)(),
    ).rejects.toThrow('Hermes still booting');

    await expect(
      (managerOptions.ensureOpenClawGatewayReady as () => Promise<void>)(),
    ).rejects.toThrow('OpenClaw runtime adapter not initialized.');

    await expect(
      (managerOptions.ensureOpenClawGatewayConnected as () => Promise<void>)(),
    ).resolves.toBeUndefined();
    expect(
      (managerOptions.getOpenClawGatewayClient as () => unknown)(),
    ).toBeNull();
    expect(
      (
        managerOptions.getOpenClawSessionKeysForCoworkSession as (
          sessionId: string,
        ) => string[]
      )('missing'),
    ).toEqual([]);

    manager.emitMock('error', {
      platform: 'telegram',
      error: new Error('boom'),
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IM Gateway] telegram error:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
