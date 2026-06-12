import type { BrowserWindowConstructorOptions } from 'electron';

export interface MainWindowOptionInput {
  title: string;
  iconPath?: string;
  isMac: boolean;
  isWindows: boolean;
  isDev: boolean;
  preloadPath: string;
  titleBarOverlay: BrowserWindowConstructorOptions['titleBarOverlay'];
  windowTheme: 'light' | 'dark';
}

function resolvePlatformOptions(
  input: Pick<
    MainWindowOptionInput,
    'isMac' | 'isWindows' | 'titleBarOverlay'
  >,
): BrowserWindowConstructorOptions {
  if (input.isMac) {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 20 },
    };
  }

  if (input.isWindows) {
    return {
      frame: false,
      titleBarStyle: 'hidden',
    };
  }

  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: input.titleBarOverlay,
  };
}

export function createMainWindowOptions(
  input: MainWindowOptionInput,
): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    title: input.title,
    icon: input.iconPath,
    ...resolvePlatformOptions(input),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: input.preloadPath,
      backgroundThrottling: false,
      devTools: input.isDev,
      spellcheck: false,
      enableWebSQL: false,
      autoplayPolicy: 'document-user-activation-required',
      disableDialogs: true,
      navigateOnDragDrop: false,
    },
    backgroundColor: input.windowTheme === 'dark' ? '#0F1117' : '#F8F9FB',
    show: false,
    autoHideMenuBar: true,
    enableLargerThanScreen: false,
  };
}
