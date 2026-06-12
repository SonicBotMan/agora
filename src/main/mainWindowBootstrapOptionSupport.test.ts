import { describe, expect, it } from 'vitest';

import { createMainWindowOptions } from './mainWindowBootstrapOptionSupport';

describe('createMainWindowOptions', () => {
  const baseInput = {
    title: 'Agora',
    iconPath: '/tmp/icon.png',
    isDev: true,
    preloadPath: '/tmp/preload.js',
    titleBarOverlay: {
      color: '#111111',
      symbolColor: '#eeeeee',
      height: 48,
    },
    windowTheme: 'dark' as const,
  };

  it('builds macOS options with hidden inset chrome', () => {
    const options = createMainWindowOptions({
      ...baseInput,
      isMac: true,
      isWindows: false,
    });

    expect(options.titleBarStyle).toBe('hiddenInset');
    expect(options.trafficLightPosition).toEqual({ x: 12, y: 20 });
    expect(options.titleBarOverlay).toBeUndefined();
    expect(options.webPreferences?.preload).toBe(baseInput.preloadPath);
    expect(options.backgroundColor).toBe('#0F1117');
  });

  it('builds windows options with custom frame handling', () => {
    const options = createMainWindowOptions({
      ...baseInput,
      isMac: false,
      isWindows: true,
      windowTheme: 'light',
    });

    expect(options.frame).toBe(false);
    expect(options.titleBarStyle).toBe('hidden');
    expect(options.titleBarOverlay).toBeUndefined();
    expect(options.backgroundColor).toBe('#F8F9FB');
  });

  it('builds linux options with title bar overlay', () => {
    const options = createMainWindowOptions({
      ...baseInput,
      isMac: false,
      isWindows: false,
    });

    expect(options.titleBarStyle).toBe('hidden');
    expect(options.titleBarOverlay).toEqual(baseInput.titleBarOverlay);
    expect(options.icon).toBe(baseInput.iconPath);
    expect(options.webPreferences?.devTools).toBe(true);
  });
});
