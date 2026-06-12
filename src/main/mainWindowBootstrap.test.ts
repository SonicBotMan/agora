import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mainWindowBootstrapSupport', () => ({
  createMainWindow: vi.fn(),
  focusExistingMainWindow: vi.fn(),
}));

import { createOrFocusMainWindow } from './mainWindowBootstrap';
import {
  createMainWindow,
  focusExistingMainWindow,
} from './mainWindowBootstrapSupport';

describe('mainWindowBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('focuses the existing main window when one is already present', () => {
    const existingWindow = { id: 'existing-window' };
    const deps = {
      getMainWindow: vi.fn().mockReturnValue(existingWindow),
    };

    vi.mocked(focusExistingMainWindow).mockReturnValue(existingWindow as never);

    expect(createOrFocusMainWindow(deps as never)).toBe(existingWindow);
    expect(focusExistingMainWindow).toHaveBeenCalledWith(existingWindow);
    expect(createMainWindow).not.toHaveBeenCalled();
  });

  it('creates a new main window when none exists', () => {
    const createdWindow = { id: 'created-window' };
    const deps = {
      getMainWindow: vi.fn().mockReturnValue(null),
    };

    vi.mocked(createMainWindow).mockReturnValue(createdWindow as never);

    expect(createOrFocusMainWindow(deps as never)).toBe(createdWindow);
    expect(createMainWindow).toHaveBeenCalledWith(deps);
    expect(focusExistingMainWindow).not.toHaveBeenCalled();
  });
});
