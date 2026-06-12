import { beforeEach, describe, expect, it, vi } from 'vitest';

const providerStoreInstances: Array<{
  getCurrentProvider: ReturnType<typeof vi.fn>;
  setCurrentProvider: ReturnType<typeof vi.fn>;
}> = [];
const telemetryStoreInstances: Array<{ db: unknown }> = [];
const trackerInstances: Array<{ deps: unknown }> = [];

vi.mock('./libs/claudeSettings', () => ({
  resolveCurrentApiConfig: vi.fn(),
}));

vi.mock('./libs/externalAgentProviderStore', () => ({
  ExternalAgentProviderStore: class {
    getCurrentProvider = vi.fn();
    setCurrentProvider = vi.fn();

    constructor() {
      providerStoreInstances.push(this);
    }
  },
}));

vi.mock('./runtimeTelemetryStore', () => ({
  RuntimeTelemetryStore: class {
    constructor(db: unknown) {
      telemetryStoreInstances.push({ db });
    }
  },
}));

vi.mock('./libs/runtimeTelemetryTracker', () => ({
  RuntimeTelemetryTracker: class {
    constructor(deps: unknown) {
      trackerInstances.push({ deps });
    }
  },
}));

import { createCoworkRuntimeSnapshot } from './coworkRuntimeSnapshot';
import { resolveCurrentApiConfig } from './libs/claudeSettings';

describe('coworkRuntimeSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerStoreInstances.length = 0;
    telemetryStoreInstances.length = 0;
    trackerInstances.length = 0;
  });

  it('lazily initializes provider and telemetry stores only once', () => {
    const database = { id: 'db' };
    const deps = {
      getStore: vi.fn().mockReturnValue({
        getDatabase: vi.fn().mockReturnValue(database),
      }),
      getCoworkStore: vi.fn().mockReturnValue({
        getConfig: vi.fn().mockReturnValue({}),
      }),
    };

    const runtime = createCoworkRuntimeSnapshot(deps as never);

    expect(runtime.getExternalAgentProviderStore()).toBe(
      runtime.getExternalAgentProviderStore(),
    );
    expect(runtime.getRuntimeTelemetryStore()).toBe(runtime.getRuntimeTelemetryStore());
    expect(deps.getStore).toHaveBeenCalledTimes(2);
    expect(providerStoreInstances).toHaveLength(1);
    expect(telemetryStoreInstances).toEqual([{ db: database }]);
  });

  it('resolves local-cli session snapshots from the current external provider', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    const provider = {
      id: 'provider-1',
      name: 'Claude Local',
      summary: {
        model: 'claude-sonnet',
      },
    };
    const coworkStore = {
      getConfig: vi.fn().mockReturnValue({
        claudeCodeConfigSource: 'local_cli',
        claudeCodePermissionMode: 'plan',
      }),
    };
    const runtime = createCoworkRuntimeSnapshot({
      getStore: vi.fn().mockReturnValue({
        getDatabase: vi.fn().mockReturnValue({ id: 'db' }),
      }),
      getCoworkStore: vi.fn().mockReturnValue(coworkStore),
    } as never);

    runtime.getExternalAgentProviderStore().getCurrentProvider.mockReturnValue(
      provider,
    );

    expect(runtime.resolveSessionRuntimeSnapshot('claude_code')).toEqual({
      agentEngine: 'claude_code',
      engineLabel: 'Claude Code',
      providerKey: 'provider-1',
      providerName: 'Claude Local',
      modelId: 'claude-sonnet',
      modelName: 'claude-sonnet',
      modelLabel: 'Claude Local · claude-sonnet',
      configSource: 'local_cli',
      permissionMode: 'plan',
      permissionModeLabel: 'Plan',
      capturedAt: 123456,
    });
  });

  it('resolves Agora-model snapshots from the current API config and falls back safely on failure', () => {
    vi.spyOn(Date, 'now').mockReturnValue(555);
    vi.mocked(resolveCurrentApiConfig).mockReturnValue({
      config: { model: 'gpt-5.1' },
      providerMetadata: {
        providerName: 'openai',
        modelName: 'GPT 5.1',
      },
    } as never);

    const runtime = createCoworkRuntimeSnapshot({
      getStore: vi.fn().mockReturnValue({
        getDatabase: vi.fn().mockReturnValue({ id: 'db' }),
      }),
      getCoworkStore: vi.fn().mockReturnValue({
        getConfig: vi.fn().mockReturnValue({}),
      }),
    } as never);

    expect(runtime.resolveSessionRuntimeSnapshot('openclaw')).toEqual({
      agentEngine: 'openclaw',
      engineLabel: 'OpenClaw',
      providerKey: 'openai',
      providerName: 'openai',
      modelId: 'gpt-5.1',
      modelName: 'GPT 5.1',
      modelLabel: 'openai · GPT 5.1',
      configSource: 'agora_model',
      permissionMode: null,
      permissionModeLabel: null,
      capturedAt: 555,
    });

    vi.mocked(resolveCurrentApiConfig).mockImplementation(() => {
      throw new Error('config failed');
    });
    expect(runtime.resolveSessionRuntimeSnapshot('openclaw')).toMatchObject({
      providerKey: null,
      providerName: null,
      modelId: null,
      modelName: null,
      modelLabel: 'Unknown model',
    });
  });

  it('restores locked local providers and configures Agora-model overrides before a turn', () => {
    const runtime = createCoworkRuntimeSnapshot({
      getStore: vi.fn().mockReturnValue({
        getDatabase: vi.fn().mockReturnValue({ id: 'db' }),
      }),
      getCoworkStore: vi.fn().mockReturnValue({
        getConfig: vi.fn().mockReturnValue({}),
      }),
    } as never);

    const providerStore = runtime.getExternalAgentProviderStore();

    runtime.prepareRuntimeSnapshotForTurn({
      agentEngine: 'codex',
      engineLabel: 'Codex CLI',
      providerKey: 'provider-1',
      providerName: 'Provider One',
      modelId: 'model-1',
      modelName: 'Model One',
      modelLabel: 'Provider One · Model One',
      configSource: 'local_cli',
      capturedAt: 100,
    });
    expect(providerStore.setCurrentProvider).toHaveBeenCalledWith(
      'codex',
      'provider-1',
    );

    runtime.prepareRuntimeSnapshotForTurn({
      agentEngine: 'openclaw',
      engineLabel: 'OpenClaw',
      providerKey: 'provider-2',
      providerName: 'Provider Two',
      modelId: 'model-2',
      modelName: 'Model Two',
      modelLabel: 'Provider Two · Model Two',
      configSource: 'agora_model',
      capturedAt: 200,
    });
    expect(resolveCurrentApiConfig).toHaveBeenCalledWith('local', {
      modelId: 'model-2',
      providerName: 'provider-2',
    });
  });

  it('creates the runtime telemetry tracker with the lazy telemetry store and model snapshot resolver', () => {
    const coworkStore = {
      getConfig: vi.fn().mockReturnValue({}),
    };
    const runtime = createCoworkRuntimeSnapshot({
      getStore: vi.fn().mockReturnValue({
        getDatabase: vi.fn().mockReturnValue({ id: 'db' }),
      }),
      getCoworkStore: vi.fn().mockReturnValue(coworkStore),
    } as never);

    expect(runtime.getRuntimeTelemetryTracker()).toBe(
      runtime.getRuntimeTelemetryTracker(),
    );
    expect(trackerInstances).toHaveLength(1);
    expect(trackerInstances[0]?.deps).toMatchObject({
      store: coworkStore,
      telemetryStore: expect.any(Object),
      getModelSnapshot: expect.any(Function),
    });
  });
});
