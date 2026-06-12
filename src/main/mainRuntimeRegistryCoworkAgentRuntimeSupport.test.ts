import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainRuntimeRegistryCoworkAgentRuntimeSupportTestState = vi.hoisted(() => {
  const createCoworkAgentRuntime = vi.fn();
  const applyExternalAgentConfigForEngine = vi.fn();

  return {
    createCoworkAgentRuntime,
    applyExternalAgentConfigForEngine,
  };
});

vi.mock('./coworkAgentRuntime', () => ({
  createCoworkAgentRuntime:
    mainRuntimeRegistryCoworkAgentRuntimeSupportTestState.createCoworkAgentRuntime,
}));

vi.mock('./libs/externalAgentConfigSync', () => ({
  applyExternalAgentConfigForEngine:
    mainRuntimeRegistryCoworkAgentRuntimeSupportTestState.applyExternalAgentConfigForEngine,
}));

import { createMainRuntimeRegistryCoworkAgentRuntimeSupport } from './mainRuntimeRegistryCoworkAgentRuntimeSupport';

function createDeps() {
  return {
    getWindows: vi.fn().mockReturnValue([]),
    getCoworkStore: vi.fn(),
    getExternalAgentCliInstaller: vi.fn(),
    getHermesEngineManager: vi.fn(),
    getHermesConfigSync: vi.fn(),
    ensureOpenClawRunningForCowork: vi.fn(),
    ensureHermesRunningForCowork: vi.fn(),
  };
}

describe('mainRuntimeRegistryCoworkAgentRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates cowork agent runtime and forwards all helper methods through the cached instance', async () => {
    const deps = createDeps();
    const runtime = {
      bindExternalAgentCliInstallerForwarder: vi.fn(),
      getAgentManager: vi.fn().mockReturnValue('agent-manager'),
      getAgentTeamRunner: vi.fn().mockReturnValue('team-runner'),
      resolveCoworkAgentEngine: vi.fn().mockReturnValue('openclaw'),
      resolveAgentRuntimeEngine: vi.fn().mockReturnValue('codex'),
      applyExternalAgentConfigSourceForEngine: vi.fn(),
      ensureCoworkEngineReady: vi.fn().mockResolvedValue({ success: true }),
    };
    let capturedDeps: Record<string, unknown> | null = null;

    mainRuntimeRegistryCoworkAgentRuntimeSupportTestState.createCoworkAgentRuntime
      .mockImplementation((input) => {
        capturedDeps = input as never;
        return runtime as never;
      });

    const support = createMainRuntimeRegistryCoworkAgentRuntimeSupport(
      deps as never,
    );

    support.bindExternalAgentCliInstallerForwarder();
    expect(support.getAgentManager()).toBe('agent-manager');
    expect(support.getAgentTeamRunner()).toBe('team-runner');
    expect(support.resolveCoworkAgentEngine()).toBe('openclaw');
    expect(support.resolveAgentRuntimeEngine('agent-1')).toBe('codex');
    support.applyExternalAgentConfigSourceForEngine('hermes' as never);
    await expect(
      support.ensureCoworkEngineReady('openclaw' as never),
    ).resolves.toEqual({ success: true });

    expect(
      mainRuntimeRegistryCoworkAgentRuntimeSupportTestState.createCoworkAgentRuntime,
    ).toHaveBeenCalledTimes(1);
    expect(capturedDeps).toMatchObject({
      getWindows: deps.getWindows,
      getCoworkStore: deps.getCoworkStore,
      getExternalAgentCliInstaller: deps.getExternalAgentCliInstaller,
      getHermesEngineManager: deps.getHermesEngineManager,
      getHermesConfigSync: deps.getHermesConfigSync,
      ensureOpenClawRunningForCowork: deps.ensureOpenClawRunningForCowork,
      ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
    });
    expect(capturedDeps?.applyExternalAgentConfigForEngine).toBe(
      mainRuntimeRegistryCoworkAgentRuntimeSupportTestState.applyExternalAgentConfigForEngine,
    );
    expect(runtime.bindExternalAgentCliInstallerForwarder).toHaveBeenCalledTimes(
      1,
    );
    expect(runtime.resolveAgentRuntimeEngine).toHaveBeenCalledWith('agent-1');
    expect(runtime.applyExternalAgentConfigSourceForEngine).toHaveBeenCalledWith(
      'hermes',
    );
    expect(runtime.ensureCoworkEngineReady).toHaveBeenCalledWith('openclaw');
  });
});
