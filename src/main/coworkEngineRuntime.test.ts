import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./coworkEngineRuntimeComposeSupport', () => ({
  createCoworkEngineRuntimeCompose: vi.fn(),
}));

import { createCoworkEngineRuntime } from './coworkEngineRuntime';
import { createCoworkEngineRuntimeCompose } from './coworkEngineRuntimeComposeSupport';

describe('coworkEngineRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates engine runtime creation to the compose support', () => {
    const deps = { getWindows: vi.fn(), getStore: vi.fn() };
    const runtime = { id: 'cowork-engine-runtime' };
    vi.mocked(createCoworkEngineRuntimeCompose).mockReturnValue(
      runtime as never,
    );

    expect(createCoworkEngineRuntime(deps as never)).toBe(runtime);
    expect(createCoworkEngineRuntimeCompose).toHaveBeenCalledWith(deps);
  });
});
