import { describe, expect, it, vi } from 'vitest';

import { createMainIpcCoreHandlerDeps } from './mainIpcCoreSupport';

describe('mainIpcCoreSupport', () => {
  it('builds core handler deps around the live store and auth helpers', () => {
    const store = {
      set: vi.fn(),
      delete: vi.fn(),
    };
    const builderDeps = {
      getMainWindow: vi.fn(),
      getStore: vi.fn().mockReturnValue(store),
      onAppConfigChanged: vi.fn(),
      shellNormalizeShellPath: vi.fn().mockImplementation((value) => value),
      getServerApiBaseUrl: vi.fn().mockReturnValue('https://api.example.com'),
      clearServerModelMetadata: vi.fn(),
      updateServerModelMetadata: vi.fn(),
      t: vi.fn((key: string) => key),
      getSkillManager: vi.fn().mockReturnValue('skill-manager'),
    };
    const getStoreValue = vi.fn().mockImplementation((key: string) => `value:${key}`);

    const deps = createMainIpcCoreHandlerDeps(
      builderDeps as never,
      getStoreValue as never,
    );

    expect(deps.getMainWindow).toBe(builderDeps.getMainWindow);
    expect(deps.getStore).toBe(getStoreValue);
    deps.setStore('theme', 'dark');
    deps.deleteStoreKey('theme');
    expect(store.set).toHaveBeenCalledWith('theme', 'dark');
    expect(store.delete).toHaveBeenCalledWith('theme');

    expect(deps.onAppConfigChanged).toBe(builderDeps.onAppConfigChanged);
    expect(deps.app.getStore()).toBe(store);
    expect(deps.updates.getStore()).toBe(store);
    expect(deps.shell.normalizeShellPath).toBe(
      builderDeps.shellNormalizeShellPath,
    );
    expect(deps.auth.getStore()).toBe(store);
    expect(deps.auth.getServerApiBaseUrl).toBe(
      builderDeps.getServerApiBaseUrl,
    );
    expect(deps.auth.clearServerModelMetadata).toBe(
      builderDeps.clearServerModelMetadata,
    );
    expect(deps.auth.updateServerModelMetadata).toBe(
      builderDeps.updateServerModelMetadata,
    );
    expect(deps.auth.t).toBe(builderDeps.t);
    expect(deps.skills.getSkillManager).toBe(builderDeps.getSkillManager);
    expect(deps.permissions).toEqual({});
    expect(deps.logs).toEqual({});
  });
});
