import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mainWindowReadyLifecycleSupport', () => ({
  registerMainWindowReadyLifecycle: vi.fn(),
}));

import { setupMainWindowReadyLifecycle } from './mainWindowReadyLifecycle';
import { registerMainWindowReadyLifecycle } from './mainWindowReadyLifecycleSupport';

describe('mainWindowReadyLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the ready lifecycle for the main window', () => {
    const window = { id: 'main-window' };
    const deps = { emitWindowState: vi.fn() };

    setupMainWindowReadyLifecycle(window as never, deps as never);

    expect(registerMainWindowReadyLifecycle).toHaveBeenCalledWith(window, deps);
  });
});
