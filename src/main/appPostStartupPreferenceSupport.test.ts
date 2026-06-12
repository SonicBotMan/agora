import { describe, expect, it, vi } from 'vitest';

import {
  applyInitialAppPreferences,
  createAppConfigChangeHandler,
} from './appPostStartupPreferenceSupport';

describe('appPostStartupPreferenceSupport', () => {
  it('applies first-run auto-launch and prevent-sleep preferences', () => {
    const get = vi
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'auto_launch_initialized') return false;
        if (key === 'prevent_sleep_enabled') return true;
        return undefined;
      });
    const set = vi.fn();
    const setAutoLaunchEnabled = vi.fn();
    const startPreventSleep = vi.fn();

    applyInitialAppPreferences(
      { get, set } as never,
      setAutoLaunchEnabled,
      startPreventSleep,
    );

    expect(set).toHaveBeenCalledWith('auto_launch_initialized', true);
    expect(set).toHaveBeenCalledWith('auto_launch_enabled', true);
    expect(setAutoLaunchEnabled).toHaveBeenCalledWith(true);
    expect(startPreventSleep).toHaveBeenCalledWith('prevent-display-sleep');
  });

  it('updates language, proxy preference, and gateway restart on config changes', async () => {
    const updateTitleBarOverlay = vi.fn();
    const setLanguage = vi.fn();
    const updateTrayMenu = vi.fn();
    const applyProxyPreference = vi.fn().mockResolvedValue(undefined);
    const restartGateway = vi.fn().mockResolvedValue(undefined);
    const getMainWindow = vi.fn();
    const handler = createAppConfigChangeHandler(
      {
        getMainWindow,
        getUseSystemProxyFromConfig: (config) => config?.useSystemProxy === true,
        applyProxyPreference,
        getOpenClawEngineManager: () => ({
          getStatus: () => ({ phase: 'running' }),
          restartGateway,
        }),
        updateTitleBarOverlay,
        setLanguage,
        updateTrayMenu,
      },
      {
        lastLanguage: 'zh',
        lastUseSystemProxy: false,
      },
    );

    handler(
      { language: 'en', useSystemProxy: true },
      { language: 'zh', useSystemProxy: false },
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(updateTitleBarOverlay).toHaveBeenCalled();
    expect(setLanguage).toHaveBeenCalledWith('en');
    expect(updateTrayMenu).toHaveBeenCalledWith(getMainWindow);
    expect(applyProxyPreference).toHaveBeenCalledWith(true);
    expect(restartGateway).toHaveBeenCalled();
  });

  it('normalizes unsupported languages to zh before updating the tray', () => {
    const setLanguage = vi.fn();
    const updateTrayMenu = vi.fn();
    const getMainWindow = vi.fn();
    const handler = createAppConfigChangeHandler(
      {
        getMainWindow,
        getUseSystemProxyFromConfig: () => false,
        applyProxyPreference: vi.fn().mockResolvedValue(undefined),
        getOpenClawEngineManager: () => ({
          getStatus: () => ({ phase: 'ready' }),
          restartGateway: vi.fn(),
        }),
        updateTitleBarOverlay: vi.fn(),
        setLanguage,
        updateTrayMenu,
      },
      {
        lastLanguage: 'en',
        lastUseSystemProxy: false,
      },
    );

    handler(
      { language: 'fr' as never, useSystemProxy: false },
      { language: 'en', useSystemProxy: false },
    );

    expect(setLanguage).toHaveBeenCalledWith('zh');
    expect(updateTrayMenu).toHaveBeenCalledWith(getMainWindow);
  });
});
