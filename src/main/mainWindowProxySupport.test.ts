import { describe, expect, it, vi } from 'vitest';

vi.mock('./libs/systemProxy', () => ({
  applySystemProxyEnv: vi.fn(),
  resolveSystemProxyUrl: vi.fn(),
  restoreOriginalProxyEnv: vi.fn(),
  setSystemProxyEnabled: vi.fn(),
}));

import {
  applySystemProxyEnv,
  resolveSystemProxyUrl,
  restoreOriginalProxyEnv,
  setSystemProxyEnabled,
} from './libs/systemProxy';
import {
  applyMainWindowProxyPreference,
  getUseSystemProxyFromConfig,
} from './mainWindowProxySupport';

describe('mainWindowProxySupport', () => {
  it('reads system proxy toggle from config', () => {
    expect(getUseSystemProxyFromConfig({ useSystemProxy: true })).toBe(true);
    expect(getUseSystemProxyFromConfig({ useSystemProxy: false })).toBe(false);
    expect(getUseSystemProxyFromConfig()).toBe(false);
  });

  it('applies direct mode when system proxy is disabled', async () => {
    const setProxy = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await applyMainWindowProxyPreference({ setProxy } as never, false);

    expect(setProxy).toHaveBeenCalledWith({ mode: 'direct' });
    expect(setSystemProxyEnabled).toHaveBeenCalledWith(false);
    expect(restoreOriginalProxyEnv).toHaveBeenCalled();
    expect(applySystemProxyEnv).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('applies resolved proxy settings when system proxy is enabled', async () => {
    const setProxy = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(resolveSystemProxyUrl).mockResolvedValue('http://127.0.0.1:7890');

    await applyMainWindowProxyPreference({ setProxy } as never, true);

    expect(setProxy).toHaveBeenCalledWith({ mode: 'system' });
    expect(setSystemProxyEnabled).toHaveBeenCalledWith(true);
    expect(resolveSystemProxyUrl).toHaveBeenCalledWith(
      'https://openrouter.ai',
    );
    expect(applySystemProxyEnv).toHaveBeenCalledWith('http://127.0.0.1:7890');

    logSpy.mockRestore();
  });
});
