import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainBootstrapIpcCoreSupport', () => ({
  createMainIpcCoreBuilderDeps: vi.fn(),
}));

vi.mock('./mainBootstrapIpcRuntimeSupport', () => ({
  createMainIpcRuntimeBuilderDeps: vi.fn(),
}));

vi.mock('./mainIpcCoreSupport', () => ({
  createMainIpcCoreHandlerDeps: vi.fn(),
}));

vi.mock('./mainIpcRuntimeSupport', () => ({
  createMainIpcRuntimeHandlerDeps: vi.fn(),
}));

import { createMainIpcCoreBuilderDeps } from './mainBootstrapIpcCoreSupport';
import { createMainIpcRuntimeBuilderDeps } from './mainBootstrapIpcRuntimeSupport';
import { createMainIpcBootstrapDeps } from './mainBootstrapIpcSupport';
import { createMainIpcCoreHandlerDeps } from './mainIpcCoreSupport';
import { createMainIpcRuntimeHandlerDeps } from './mainIpcRuntimeSupport';

describe('mainBootstrapIpcSupport', () => {
  it('builds ipc bootstrap deps from core/runtime builders and handler deps', () => {
    const coreBuilderDeps = {
      onNetworkOnline: vi.fn(),
    };
    const runtimeBuilderDeps = { runtime: true };
    const coreHandlerDeps = { core: true };
    const runtimeHandlerDeps = { runtime: true };

    vi.mocked(createMainIpcCoreBuilderDeps).mockReturnValue(
      coreBuilderDeps as never,
    );
    vi.mocked(createMainIpcRuntimeBuilderDeps).mockReturnValue(
      runtimeBuilderDeps as never,
    );
    vi.mocked(createMainIpcCoreHandlerDeps).mockImplementation(
      (_deps, getStoreValue) => {
        expect(getStoreValue('present', 'fallback')).toBe('stored-value');
        expect(getStoreValue('missing', 'fallback')).toBe('fallback');
        return coreHandlerDeps as never;
      },
    );
    vi.mocked(createMainIpcRuntimeHandlerDeps).mockReturnValue(
      runtimeHandlerDeps as never,
    );

    const deps = createMainIpcBootstrapDeps({
      runtime: {
        getStore: () => ({
          get: (key: string) =>
            key === 'present' ? 'stored-value' : undefined,
        }),
      },
    } as never);

    expect(deps).toEqual({
      onNetworkOnline: coreBuilderDeps.onNetworkOnline,
      handlers: {
        core: true,
        runtime: true,
      },
    });
    expect(createMainIpcCoreBuilderDeps).toHaveBeenCalled();
    expect(createMainIpcRuntimeBuilderDeps).toHaveBeenCalled();
  });
});
