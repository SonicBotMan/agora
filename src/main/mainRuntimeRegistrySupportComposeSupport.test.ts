import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainRuntimeRegistryServiceSupport', () => ({
  createMainRuntimeRegistryServiceSupport: vi.fn(),
}));

vi.mock('./mainRuntimeRegistrySnapshotSupport', () => ({
  createMainRuntimeRegistrySnapshotSupport: vi.fn(),
}));

vi.mock('./mainRuntimeRegistryStoreSupport', () => ({
  createMainRuntimeRegistryStoreSupport: vi.fn(),
}));

import { createMainRuntimeRegistryServiceSupport } from './mainRuntimeRegistryServiceSupport';
import { createMainRuntimeRegistrySnapshotSupport } from './mainRuntimeRegistrySnapshotSupport';
import { createMainRuntimeRegistryStoreSupport } from './mainRuntimeRegistryStoreSupport';
import { createMainRuntimeRegistrySupportCompose } from './mainRuntimeRegistrySupportComposeSupport';

describe('mainRuntimeRegistrySupportComposeSupport', () => {
  it('composes store, snapshot, and service supports with shared dependencies', () => {
    let capturedSnapshotDeps: Record<string, unknown> | null = null;
    let capturedServiceDeps: Record<string, unknown> | null = null;

    const storeSupport = {
      storeKey: 'store',
      getStore: vi.fn(),
      getCoworkStore: vi.fn(),
    };
    const snapshotSupport = {
      snapshotKey: 'snapshot',
    };
    const serviceSupport = {
      serviceKey: 'service',
    };

    vi.mocked(createMainRuntimeRegistryStoreSupport).mockReturnValue(
      storeSupport as never,
    );
    vi.mocked(createMainRuntimeRegistrySnapshotSupport).mockImplementation(
      (deps) => {
        capturedSnapshotDeps = deps as never;
        return snapshotSupport as never;
      },
    );
    vi.mocked(createMainRuntimeRegistryServiceSupport).mockImplementation(
      (deps) => {
        capturedServiceDeps = deps as never;
        return serviceSupport as never;
      },
    );

    const getCoworkEngineRouter = vi.fn();
    const getIMGatewayManager = vi.fn().mockReturnValue('im-gateway-manager');
    const syncOpenClawConfig = vi.fn();
    const getWindows = vi.fn().mockReturnValue([]);

    const result = createMainRuntimeRegistrySupportCompose({
      app: { name: 'app' } as never,
      getWindows,
      getCoworkEngineRouter,
      getIMGatewayManager,
      syncOpenClawConfig,
    });

    expect(createMainRuntimeRegistryStoreSupport).toHaveBeenCalledWith({
      app: { name: 'app' },
    });
    expect(capturedSnapshotDeps).toMatchObject({
      getWindows,
      getCoworkEngineRouter,
    });
    expect(capturedSnapshotDeps?.getStore).toBe(storeSupport.getStore);
    expect(capturedSnapshotDeps?.getCoworkStore).toBe(
      storeSupport.getCoworkStore,
    );
    expect(capturedServiceDeps).toMatchObject({
      getWindows,
      syncOpenClawConfig,
    });
    expect(capturedServiceDeps?.getIMGatewayManager).toBe(getIMGatewayManager);
    expect(capturedServiceDeps?.getStore).toBe(storeSupport.getStore);
    expect(result).toMatchObject({
      storeKey: 'store',
      snapshotKey: 'snapshot',
      serviceKey: 'service',
    });
  });
});
