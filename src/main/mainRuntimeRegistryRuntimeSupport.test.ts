import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mainRuntimeRegistryRuntimeComposeSupport', () => ({
  createMainRuntimeRegistryRuntimeCompose: vi.fn(),
}));

import { createMainRuntimeRegistryRuntimeCompose } from './mainRuntimeRegistryRuntimeComposeSupport';
import { createMainRuntimeRegistryRuntimeSupport } from './mainRuntimeRegistryRuntimeSupport';

describe('mainRuntimeRegistryRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates runtime support creation to the compose support', () => {
    const deps = { getWindows: vi.fn(), support: { id: 'support' } };
    const runtime = { id: 'runtime' };
    vi.mocked(createMainRuntimeRegistryRuntimeCompose).mockReturnValue(
      runtime as never,
    );

    expect(createMainRuntimeRegistryRuntimeSupport(deps as never)).toBe(runtime);
    expect(createMainRuntimeRegistryRuntimeCompose).toHaveBeenCalledWith(deps);
  });
});
