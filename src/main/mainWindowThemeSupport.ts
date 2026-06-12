import type { BrowserWindowConstructorOptions } from 'electron';

export type MainWindowTheme = 'light' | 'dark';

export type AppConfigSettings = {
  theme?: string;
  useSystemProxy?: boolean;
};

export type TitleBarOverlayOptions = Exclude<
  NonNullable<BrowserWindowConstructorOptions['titleBarOverlay']>,
  boolean
>;

const TITLEBAR_HEIGHT = 48;
const TITLEBAR_COLORS = {
  dark: { color: '#0F1117', symbolColor: '#E4E5E9' },
  // Align light title bar with app light surface-muted tone to reduce visual contrast.
  light: { color: '#F3F4F6', symbolColor: '#1A1D23' },
} as const;

export function resolveThemeFromConfig(
  config: Pick<AppConfigSettings, 'theme'> | undefined,
  shouldUseDarkColors: boolean,
): MainWindowTheme {
  if (config?.theme === 'dark') {
    return 'dark';
  }
  if (config?.theme === 'light') {
    return 'light';
  }
  return shouldUseDarkColors ? 'dark' : 'light';
}

export function createTitleBarOverlayOptions(
  theme: MainWindowTheme,
): TitleBarOverlayOptions {
  return {
    color: TITLEBAR_COLORS[theme].color,
    symbolColor: TITLEBAR_COLORS[theme].symbolColor,
    height: TITLEBAR_HEIGHT,
  };
}

export function resolveWindowBackgroundColor(
  theme: MainWindowTheme,
): string {
  return theme === 'dark' ? '#0F1117' : '#F8F9FB';
}
