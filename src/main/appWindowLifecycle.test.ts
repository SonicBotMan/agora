import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerWindowAllClosedLifecycle } from './appWindowLifecycle';

describe('appWindowLifecycle', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('quits the app on window-all-closed outside macOS and keeps the app alive on macOS', () => {
    let windowAllClosedHandler: (() => void) | null = null;
    const app = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'window-all-closed') {
          windowAllClosedHandler = handler;
        }
      }),
      quit: vi.fn(),
    };

    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });
    registerWindowAllClosedLifecycle(app as never);
    windowAllClosedHandler?.();
    expect(app.quit).toHaveBeenCalledTimes(1);

    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
    registerWindowAllClosedLifecycle(app as never);
    windowAllClosedHandler?.();
    expect(app.quit).toHaveBeenCalledTimes(1);
  });
});
