import { describe, expect, it, vi } from 'vitest';

import {
  focusExistingMainWindow,
  registerAppActivateLifecycle,
} from './appPostStartupWindowSupport';

describe('appPostStartupWindowSupport', () => {
  it('focuses an existing main window when available', () => {
    const show = vi.fn();
    const focus = vi.fn();

    const focused = focusExistingMainWindow({
      isDestroyed: () => false,
      isVisible: () => false,
      isFocused: () => false,
      show,
      focus,
    } as never);

    expect(focused).toBe(true);
    expect(show).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('creates a window on activate when no existing window is available', () => {
    let activateHandler: (() => void) | null = null;
    const createWindow = vi.fn();

    registerAppActivateLifecycle(
      () => null,
      createWindow,
      {
        on: (_event, handler) => {
          activateHandler = handler;
        },
      },
    );

    activateHandler?.();

    expect(createWindow).toHaveBeenCalled();
  });
});
