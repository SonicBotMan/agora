import { describe, expect, it } from 'vitest';

import {
  createTitleBarOverlayOptions,
  resolveThemeFromConfig,
  resolveWindowBackgroundColor,
} from './mainWindowThemeSupport';

describe('mainWindowThemeSupport', () => {
  it('prefers explicit theme from config', () => {
    expect(resolveThemeFromConfig({ theme: 'dark' }, false)).toBe('dark');
    expect(resolveThemeFromConfig({ theme: 'light' }, true)).toBe('light');
  });

  it('falls back to system theme when config is unset', () => {
    expect(resolveThemeFromConfig(undefined, true)).toBe('dark');
    expect(resolveThemeFromConfig(undefined, false)).toBe('light');
  });

  it('creates title bar overlay options for dark theme', () => {
    expect(createTitleBarOverlayOptions('dark')).toEqual({
      color: '#0F1117',
      symbolColor: '#E4E5E9',
      height: 48,
    });
  });

  it('resolves light theme background color', () => {
    expect(resolveWindowBackgroundColor('light')).toBe('#F8F9FB');
  });
});
