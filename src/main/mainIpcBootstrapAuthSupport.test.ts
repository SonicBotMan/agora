import { describe, expect, it, vi } from 'vitest';

import { createMainIpcAuthTokenAccessors } from './mainIpcBootstrapAuthSupport';

describe('mainIpcBootstrapAuthSupport', () => {
  it('persists and reads auth tokens from store', () => {
    const set = vi.fn();
    const get = vi
      .fn()
      .mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
    const accessors = createMainIpcAuthTokenAccessors({
      getStore: () => ({ set, get }) as never,
    });

    accessors.saveAuthTokens('access', 'refresh');

    expect(set).toHaveBeenCalledWith('auth_tokens', {
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(accessors.getAuthTokens()).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });
});
