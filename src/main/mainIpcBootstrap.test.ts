import { describe, expect, it, vi } from 'vitest';

vi.mock('./ipc', () => ({
  registerAllHandlers: vi.fn(),
}));

vi.mock('./mainIpcBootstrapSupport', () => ({
  registerNetworkStatusChangeListener: vi.fn(),
}));

import { registerAllHandlers } from './ipc';
import { registerMainIpcBootstrap } from './mainIpcBootstrap';
import { registerNetworkStatusChangeListener } from './mainIpcBootstrapSupport';

describe('mainIpcBootstrap', () => {
  it('registers network listener and all handlers, then exposes auth token accessors', () => {
    const set = vi.fn();
    const get = vi
      .fn()
      .mockReturnValue({ accessToken: 'stored-access', refreshToken: 'stored-refresh' });
    const handlers = {
      auth: {
        getStore: () => ({ set, get }),
      },
    } as never;
    const onNetworkOnline = vi.fn();

    const result = registerMainIpcBootstrap({
      onNetworkOnline,
      handlers,
    });

    expect(registerNetworkStatusChangeListener).toHaveBeenCalledWith(
      onNetworkOnline,
    );
    expect(registerAllHandlers).toHaveBeenCalledWith(handlers);
    expect(result.getAuthTokens()).toEqual({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
    });

    result.saveAuthTokens('next-access', 'next-refresh');
    expect(set).toHaveBeenCalledWith('auth_tokens', {
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });
  });
});
