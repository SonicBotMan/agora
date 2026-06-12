import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainRuntimeRegistrySnapshotRuntimeSupportTestState = vi.hoisted(() => {
  const createCoworkRuntimeSnapshot = vi.fn();

  return {
    createCoworkRuntimeSnapshot,
  };
});

vi.mock('./coworkRuntimeSnapshot', () => ({
  createCoworkRuntimeSnapshot:
    mainRuntimeRegistrySnapshotRuntimeSupportTestState.createCoworkRuntimeSnapshot,
}));

import { createMainRuntimeRegistrySnapshotRuntimeSupport } from './mainRuntimeRegistrySnapshotRuntimeSupport';

describe('mainRuntimeRegistrySnapshotRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates snapshot runtime and forwards provider, telemetry, and snapshot helpers', () => {
    const deps = {
      getWindows: vi.fn().mockReturnValue([]),
      getStore: vi.fn(),
      getCoworkStore: vi.fn(),
      getCoworkEngineRouter: vi.fn(),
    };
    const runtime = {
      getExternalAgentProviderStore: vi.fn().mockReturnValue('provider-store'),
      getRuntimeTelemetryStore: vi.fn().mockReturnValue('telemetry-store'),
      resolveSessionRuntimeSnapshot: vi.fn().mockReturnValue('snapshot'),
      prepareRuntimeSnapshotForTurn: vi.fn(),
      getRuntimeTelemetryTracker: vi.fn().mockReturnValue('telemetry-tracker'),
    };
    let capturedDeps: Record<string, unknown> | null = null;

    mainRuntimeRegistrySnapshotRuntimeSupportTestState.createCoworkRuntimeSnapshot
      .mockImplementation((input) => {
        capturedDeps = input as never;
        return runtime as never;
      });

    const support = createMainRuntimeRegistrySnapshotRuntimeSupport(
      deps as never,
    );

    expect(support.getExternalAgentProviderStore()).toBe('provider-store');
    expect(support.getRuntimeTelemetryStore()).toBe('telemetry-store');
    expect(support.resolveSessionRuntimeSnapshot('openclaw' as never)).toBe(
      'snapshot',
    );
    support.prepareRuntimeSnapshotForTurn('snapshot' as never);
    expect(support.getRuntimeTelemetryTracker()).toBe('telemetry-tracker');

    expect(
      mainRuntimeRegistrySnapshotRuntimeSupportTestState.createCoworkRuntimeSnapshot,
    ).toHaveBeenCalledTimes(1);
    expect(capturedDeps).toMatchObject({
      getStore: deps.getStore,
      getCoworkStore: deps.getCoworkStore,
    });
    expect(runtime.resolveSessionRuntimeSnapshot).toHaveBeenCalledWith(
      'openclaw',
    );
    expect(runtime.prepareRuntimeSnapshotForTurn).toHaveBeenCalledWith(
      'snapshot',
    );
  });
});
