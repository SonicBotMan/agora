import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeSkillStartupBootstrapTestState = vi.hoisted(() => {
  const startCoworkOpenAICompatProxy = vi.fn().mockResolvedValue(undefined);
  const bootstrapRuntimeEngineSync = vi.fn().mockResolvedValue(undefined);
  const startOpenClawRuntimeIfNeeded = vi.fn();
  const initializeRuntimeSkillManager = vi.fn();
  const initializeRuntimeSkillServices = vi.fn().mockResolvedValue(undefined);
  const finalizeRuntimeProxyStartup = vi.fn().mockResolvedValue(undefined);

  return {
    startCoworkOpenAICompatProxy,
    bootstrapRuntimeEngineSync,
    startOpenClawRuntimeIfNeeded,
    initializeRuntimeSkillManager,
    initializeRuntimeSkillServices,
    finalizeRuntimeProxyStartup,
  };
});

vi.mock('./libs/coworkOpenAICompatProxy', () => ({
  startCoworkOpenAICompatProxy:
    runtimeSkillStartupBootstrapTestState.startCoworkOpenAICompatProxy,
}));

vi.mock('./runtimeSkillStartupEngineSupport', () => ({
  bootstrapRuntimeEngineSync:
    runtimeSkillStartupBootstrapTestState.bootstrapRuntimeEngineSync,
  startOpenClawRuntimeIfNeeded:
    runtimeSkillStartupBootstrapTestState.startOpenClawRuntimeIfNeeded,
  finalizeRuntimeProxyStartup:
    runtimeSkillStartupBootstrapTestState.finalizeRuntimeProxyStartup,
}));

vi.mock('./runtimeSkillStartupSkillSupport', () => ({
  initializeRuntimeSkillManager:
    runtimeSkillStartupBootstrapTestState.initializeRuntimeSkillManager,
  initializeRuntimeSkillServices:
    runtimeSkillStartupBootstrapTestState.initializeRuntimeSkillServices,
}));

import { bootstrapRuntimeSkillStartup } from './runtimeSkillStartupBootstrap';

describe('runtimeSkillStartupBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bootstraps runtime engine sync, optional OpenClaw startup, skill manager/services, and final proxy startup in order', async () => {
    const deps = {
      store: { get: vi.fn() },
      bindCoworkRuntimeForwarder: vi.fn(),
      bindOpenClawStatusForwarder: vi.fn(),
      syncOpenClawConfig: vi.fn(),
      getHermesConfigSync: vi.fn(),
      resolveCoworkAgentEngine: vi.fn(),
      ensureOpenClawRunningForCowork: vi.fn(),
      getCronJobService: vi.fn(),
      getSkillManager: vi.fn(),
      getUseSystemProxyFromConfig: vi.fn(),
      applyProxyPreference: vi.fn(),
    };

    await bootstrapRuntimeSkillStartup(deps as never);

    expect(
      runtimeSkillStartupBootstrapTestState.bootstrapRuntimeEngineSync,
    ).toHaveBeenCalledWith(deps);
    expect(
      runtimeSkillStartupBootstrapTestState.startOpenClawRuntimeIfNeeded,
    ).toHaveBeenCalledWith(deps);
    expect(
      runtimeSkillStartupBootstrapTestState.initializeRuntimeSkillManager,
    ).toHaveBeenCalledWith(deps);
    expect(
      runtimeSkillStartupBootstrapTestState.initializeRuntimeSkillServices,
    ).toHaveBeenCalledTimes(1);
    expect(
      runtimeSkillStartupBootstrapTestState.finalizeRuntimeProxyStartup,
    ).toHaveBeenCalledWith({
      ...deps,
      startCoworkOpenAICompatProxy:
        runtimeSkillStartupBootstrapTestState.startCoworkOpenAICompatProxy,
    });

    expect(
      runtimeSkillStartupBootstrapTestState.startOpenClawRuntimeIfNeeded
        .mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      runtimeSkillStartupBootstrapTestState.bootstrapRuntimeEngineSync
        .mock.invocationCallOrder[0],
    );
    expect(
      runtimeSkillStartupBootstrapTestState.finalizeRuntimeProxyStartup
        .mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      runtimeSkillStartupBootstrapTestState.initializeRuntimeSkillServices
        .mock.invocationCallOrder[0],
    );
  });
});
