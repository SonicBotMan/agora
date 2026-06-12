import type { BrowserWindow } from 'electron';

import type { MainWindowLifecycleDeps } from './mainWindowLifecycleContract';

function sendEngineStatuses(
  window: BrowserWindow,
  deps: Pick<
    MainWindowLifecycleDeps,
    'openClawEngineManager' | 'hermesEngineManager'
  >,
): void {
  if (deps.openClawEngineManager && !window.isDestroyed()) {
    window.webContents.send(
      'openclaw:engine:onProgress',
      deps.openClawEngineManager.getStatus(),
    );
  }
  if (deps.hermesEngineManager && !window.isDestroyed()) {
    window.webContents.send(
      'hermes:engine:onProgress',
      deps.hermesEngineManager.getStatus(),
    );
  }
}

export function registerMainWindowLoadLifecycle(
  window: BrowserWindow,
  deps: Pick<
    MainWindowLifecycleDeps,
    | 'isDev'
    | 'devServerUrl'
    | 'errorPagePath'
    | 'prodIndexPath'
    | 'emitWindowState'
    | 'scheduleReload'
    | 'openClawEngineManager'
    | 'hermesEngineManager'
  >,
): void {
  const loadTimeout = setTimeout(() => {
    if (window.isDestroyed()) return;
    if (window.webContents.isLoadingMainFrame()) {
      console.log('Window load timed out, attempting to reload...');
      deps.scheduleReload('load-timeout');
    }
  }, 30000);

  window.webContents.once('did-finish-load', () => {
    clearTimeout(loadTimeout);
  });

  window.webContents.on('did-finish-load', () => {
    deps.emitWindowState();
    sendEngineStatuses(window, deps);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Window render process gone:', details);
    deps.scheduleReload('webContents-crashed');
  });

  if (deps.isDev) {
    const maxRetries = 3;
    let retryCount = 0;

    const tryLoadURL = () => {
      window.loadURL(deps.devServerUrl).catch((error) => {
        console.error('Failed to load URL:', error);
        retryCount++;

        if (retryCount < maxRetries) {
          console.log(`Retrying to load URL (${retryCount}/${maxRetries})...`);
          setTimeout(tryLoadURL, 3000);
        } else {
          console.error('Failed to load URL after maximum retries');
          if (!window.isDestroyed()) {
            void window.loadFile(deps.errorPagePath);
          }
        }
      });
    };

    tryLoadURL();
    window.webContents.openDevTools();
  } else {
    void window.loadFile(deps.prodIndexPath);
  }

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode: number, errorDescription: string) => {
      console.error('Page failed to load:', errorCode, errorDescription);
      if (deps.isDev) {
        setTimeout(() => {
          deps.scheduleReload('did-fail-load');
        }, 3000);
      }
    },
  );
}

export function registerMainWindowEventLifecycle(
  window: BrowserWindow,
  deps: Pick<
    MainWindowLifecycleDeps,
    'isDev' | 'isQuitting' | 'emitWindowState' | 'onWindowClosed'
  >,
): void {
  window.setMinimumSize(800, 600);

  window.on('close', (event) => {
    if (!deps.isQuitting() && !deps.isDev) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on('closed', () => {
    deps.onWindowClosed();
  });

  const forwardWindowState = () => deps.emitWindowState();
  window.on('maximize', forwardWindowState);
  window.on('unmaximize', forwardWindowState);
  window.on('enter-full-screen', forwardWindowState);
  window.on('leave-full-screen', forwardWindowState);
  window.on('focus', forwardWindowState);
  window.on('blur', forwardWindowState);
}
