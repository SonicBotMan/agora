import { describe, expect, it, vi } from 'vitest';

import {
  applyColdStartDeepLink,
  resolveColdStartAuthCode,
} from './appPostStartupDeepLinkSupport';

describe('appPostStartupDeepLinkSupport', () => {
  it('extracts auth callback code from cold-start args', () => {
    expect(
      resolveColdStartAuthCode([
        '--foo',
        'agora://auth/callback?code=demo-code',
      ]),
    ).toBe('demo-code');
  });

  it('ignores unrelated deep links', () => {
    expect(
      resolveColdStartAuthCode([
        'agora://settings/open?tab=general',
      ]),
    ).toBeNull();
  });

  it('applies pending auth code when found', () => {
    const setPendingAuthCode = vi.fn();

    applyColdStartDeepLink(
      ['agora://auth/callback?code=demo-code'],
      setPendingAuthCode,
    );

    expect(setPendingAuthCode).toHaveBeenCalledWith('demo-code');
  });
});
