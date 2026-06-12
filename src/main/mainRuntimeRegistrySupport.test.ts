import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mainRuntimeRegistrySupportComposeSupport', () => ({
  createMainRuntimeRegistrySupportCompose: vi.fn(),
}));

import { createMainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';
import { createMainRuntimeRegistrySupportCompose } from './mainRuntimeRegistrySupportComposeSupport';

describe('mainRuntimeRegistrySupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates support creation to the compose support', () => {
    const deps = { app: { name: 'app' } };
    const support = { id: 'registry-support' };
    vi.mocked(createMainRuntimeRegistrySupportCompose).mockReturnValue(
      support as never,
    );

    expect(createMainRuntimeRegistrySupport(deps as never)).toBe(support);
    expect(createMainRuntimeRegistrySupportCompose).toHaveBeenCalledWith(deps);
  });
});
