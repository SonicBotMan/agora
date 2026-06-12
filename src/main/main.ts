import { app, BrowserWindow, session } from 'electron';

import { APP_NAME } from './appConstants';
import { createMainBootstrapWiring } from './mainBootstrapWiring';
import { bootstrapMainProcessEnvironment } from './mainProcessEnvironment';
import { createMainRuntimeRegistry } from './mainRuntimeRegistry';
import { createMainWindowRuntimeController } from './mainWindowRuntimeController';
import { bootstrapSingleInstanceApp } from './singleInstanceAppBootstrap';

// 设置应用程序名称
app.name = APP_NAME;
app.setName(APP_NAME);

const {
  devServerUrl,
  isDev,
  isMac,
  isWindows,
  normalizeShellPath,
  registerLifecycleHandlers,
} = bootstrapMainProcessEnvironment(app);
const runtime = createMainRuntimeRegistry({
  app,
  getWindows: () => BrowserWindow.getAllWindows(),
});

// 保存对主窗口的引用
let mainWindow: BrowserWindow | null = null;

let isQuitting = false;
const windowController = createMainWindowRuntimeController({
  getStore: runtime.getStore,
  getMainWindow: () => mainWindow,
  isMac,
  isWindows,
  defaultSession: session.defaultSession,
});

registerLifecycleHandlers({
  scheduleReload: windowController.scheduleReload,
});

bootstrapSingleInstanceApp(
  createMainBootstrapWiring({
    app,
    moduleDir: __dirname,
    isDev,
    isMac,
    isWindows,
    devServerUrl,
    normalizeShellPath,
    runtime,
    windowController,
    state: {
      getMainWindow: () => mainWindow,
      setMainWindow: (window) => {
        mainWindow = window;
      },
      isQuitting: () => isQuitting,
      markQuitting: () => {
        isQuitting = true;
      },
    },
  }),
);
