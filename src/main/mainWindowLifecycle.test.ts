import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mainWindowLifecycleEventSupport', () => ({
  registerMainWindowEventLifecycle: vi.fn(),
  registerMainWindowLoadLifecycle: vi.fn(),
}));

import { setupMainWindowLifecycle } from './mainWindowLifecycle';
import {
  registerMainWindowEventLifecycle,
  registerMainWindowLoadLifecycle,
} from './mainWindowLifecycleEventSupport';

describe('mainWindowLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers both event and load lifecycle hooks for the main window', () => {
    const window = { id: 'main-window' };
    const deps = { isDev: true };

    setupMainWindowLifecycle(window as never, deps as never);

    expect(registerMainWindowEventLifecycle).toHaveBeenCalledWith(window, deps);
    expect(registerMainWindowLoadLifecycle).toHaveBeenCalledWith(window, deps);
  });
});
