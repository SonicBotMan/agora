import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainRuntimeRegistrySnapshotForwarderSupportTestState = vi.hoisted(() => {
  const createCoworkRuntimeForwarder = vi.fn();
  const resolveCurrentApiConfig = vi.fn();

  return {
    createCoworkRuntimeForwarder,
    resolveCurrentApiConfig,
  };
});

vi.mock('./coworkRuntimeForwarder', () => ({
  createCoworkRuntimeForwarder:
    mainRuntimeRegistrySnapshotForwarderSupportTestState.createCoworkRuntimeForwarder,
}));

vi.mock('./libs/claudeSettings', () => ({
  resolveCurrentApiConfig:
    mainRuntimeRegistrySnapshotForwarderSupportTestState.resolveCurrentApiConfig,
}));

import { createMainRuntimeRegistrySnapshotForwarderSupport } from './mainRuntimeRegistrySnapshotForwarderSupport';

describe('mainRuntimeRegistrySnapshotForwarderSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates a singleton forwarder and computes quota broadcasting from provider metadata', () => {
    const deps = {
      getWindows: vi.fn().mockReturnValue([]),
      getCoworkStore: vi.fn(),
      getCoworkEngineRouter: vi.fn(),
    };
    const forwarder = { id: 'cowork-runtime-forwarder' };
    let capturedDeps: Record<string, unknown> | null = null;

    mainRuntimeRegistrySnapshotForwarderSupportTestState.createCoworkRuntimeForwarder
      .mockImplementation((input) => {
        capturedDeps = input as never;
        return forwarder as never;
      });
    mainRuntimeRegistrySnapshotForwarderSupportTestState.resolveCurrentApiConfig
      .mockReturnValue({
        providerMetadata: { providerName: 'agora-server' },
      });

    const support = createMainRuntimeRegistrySnapshotForwarderSupport(
      deps as never,
    );

    expect(support.peekCoworkRuntimeForwarder()).toBeNull();
    expect(support.getCoworkRuntimeForwarder()).toBe(forwarder);
    expect(support.getCoworkRuntimeForwarder()).toBe(forwarder);
    expect(
      mainRuntimeRegistrySnapshotForwarderSupportTestState.createCoworkRuntimeForwarder,
    ).toHaveBeenCalledTimes(1);
    expect(capturedDeps).toMatchObject({
      getWindows: deps.getWindows,
      getCoworkStore: deps.getCoworkStore,
      getCoworkEngineRouter: deps.getCoworkEngineRouter,
    });
    expect(
      (
        capturedDeps?.shouldBroadcastQuotaChanged as
          | (() => boolean)
          | undefined
      )?.(),
    ).toBe(true);

    mainRuntimeRegistrySnapshotForwarderSupportTestState.resolveCurrentApiConfig
      .mockReturnValue({
        providerMetadata: { providerName: 'other-provider' },
      });
    expect(
      (
        capturedDeps?.shouldBroadcastQuotaChanged as
          | (() => boolean)
          | undefined
      )?.(),
    ).toBe(false);

    mainRuntimeRegistrySnapshotForwarderSupportTestState.resolveCurrentApiConfig
      .mockImplementation(() => {
        throw new Error('settings-unavailable');
      });
    expect(
      (
        capturedDeps?.shouldBroadcastQuotaChanged as
          | (() => boolean)
          | undefined
      )?.(),
    ).toBe(false);
    expect(support.peekCoworkRuntimeForwarder()).toBe(forwarder);
  });
});
