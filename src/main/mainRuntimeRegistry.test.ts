import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainRuntimeRegistryRuntimeSupport', () => ({
  createMainRuntimeRegistryRuntimeSupport: vi.fn(),
}));

vi.mock('./mainRuntimeRegistrySupport', () => ({
  createMainRuntimeRegistrySupport: vi.fn(),
}));

import { createMainRuntimeRegistry } from './mainRuntimeRegistry';
import { createMainRuntimeRegistryRuntimeSupport } from './mainRuntimeRegistryRuntimeSupport';
import { createMainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';

describe('mainRuntimeRegistry', () => {
  it('wires support callbacks back to runtime support and merges both layers', async () => {
    let capturedSupportDeps: Record<string, unknown> | null = null;
    const getCoworkEngineRouter = vi.fn().mockReturnValue('router');
    const getIMGatewayManager = vi.fn().mockReturnValue('im-gateway-manager');
    const syncOpenClawConfig = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(createMainRuntimeRegistrySupport).mockImplementation((deps) => {
      capturedSupportDeps = deps as never;
      return { supportKey: 'support' } as never;
    });

    vi.mocked(createMainRuntimeRegistryRuntimeSupport).mockImplementation(
      () =>
        ({
          runtimeKey: 'runtime',
          getCoworkEngineRouter,
          getIMGatewayManager,
          syncOpenClawConfig,
        }) as never,
    );

    const getWindows = vi.fn().mockReturnValue([]);
    const registry = createMainRuntimeRegistry({
      app: { name: 'app' } as never,
      getWindows,
    });

    expect(createMainRuntimeRegistrySupport).toHaveBeenCalled();
    expect(createMainRuntimeRegistryRuntimeSupport).toHaveBeenCalledWith({
      getWindows,
      support: { supportKey: 'support' },
    });
    expect(registry).toMatchObject({
      supportKey: 'support',
      runtimeKey: 'runtime',
    });

    expect(capturedSupportDeps?.getCoworkEngineRouter()).toBe('router');
    expect(capturedSupportDeps?.getIMGatewayManager()).toBe(
      'im-gateway-manager',
    );
    await expect(
      capturedSupportDeps?.syncOpenClawConfig({
        reason: 'test',
      }),
    ).resolves.toEqual({ success: true });
    expect(getCoworkEngineRouter).toHaveBeenCalled();
    expect(getIMGatewayManager).toHaveBeenCalled();
    expect(syncOpenClawConfig).toHaveBeenCalledWith({ reason: 'test' });
  });
});
