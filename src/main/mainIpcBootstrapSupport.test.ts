import { describe, expect, it, vi } from 'vitest';

import { registerNetworkStatusChangeListener } from './mainIpcBootstrapSupport';

describe('mainIpcBootstrapSupport', () => {
  it('registers network status listener and only triggers callback on online', () => {
    let networkHandler:
      | ((event: unknown, status: 'online' | 'offline') => void)
      | null = null;
    const onNetworkOnline = vi.fn();

    registerNetworkStatusChangeListener(onNetworkOnline, {
      removeAllListeners: vi.fn(),
      on: vi.fn((_event, handler) => {
        networkHandler = handler;
      }),
    });

    networkHandler?.(null, 'offline');
    networkHandler?.(null, 'online');

    expect(onNetworkOnline).toHaveBeenCalledTimes(1);
  });
});
