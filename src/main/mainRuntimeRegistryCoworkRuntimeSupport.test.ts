import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mainRuntimeRegistryCoworkRuntimeComposeSupport', () => ({
  createMainRuntimeRegistryCoworkRuntimeCompose: vi.fn(),
}));

import { createMainRuntimeRegistryCoworkRuntimeCompose } from './mainRuntimeRegistryCoworkRuntimeComposeSupport';
import { createMainRuntimeRegistryCoworkRuntimeSupport } from './mainRuntimeRegistryCoworkRuntimeSupport';

describe('mainRuntimeRegistryCoworkRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates cowork runtime support creation to the compose support', () => {
    const deps = { getWindows: vi.fn(), getCoworkStore: vi.fn() };
    const support = { id: 'cowork-runtime-support' };
    vi.mocked(createMainRuntimeRegistryCoworkRuntimeCompose).mockReturnValue(
      support as never,
    );

    expect(createMainRuntimeRegistryCoworkRuntimeSupport(deps as never)).toBe(
      support,
    );
    expect(createMainRuntimeRegistryCoworkRuntimeCompose).toHaveBeenCalledWith(
      deps,
    );
  });
});
