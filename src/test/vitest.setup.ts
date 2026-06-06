import { vi } from "vitest";

vi.mock("electron", async () => {
  const os = await import("os");
  const path = await import("path");
  const { EventEmitter } = await import("events");
  const testUserDataPath = path.join(os.tmpdir(), "agora-vitest-user-data");

  class MockBrowserWindow extends EventEmitter {
    static getAllWindows = vi.fn(() => []);
    static fromWebContents = vi.fn(() => null);

    webContents = {
      send: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      isDestroyed: vi.fn(() => false),
    };

    isDestroyed = vi.fn(() => false);
    show = vi.fn();
    hide = vi.fn();
    close = vi.fn();
    focus = vi.fn();
    loadURL = vi.fn();
  }

  const defaultSession = {
    cookies: {
      get: vi.fn(async () => []),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
    clearStorageData: vi.fn(async () => undefined),
    setProxy: vi.fn(async () => undefined),
    resolveProxy: vi.fn(async () => "DIRECT"),
    webRequest: {
      onBeforeRequest: vi.fn(),
      onHeadersReceived: vi.fn(),
    },
  };

  return {
    app: {
      commandLine: { appendSwitch: vi.fn() },
      getAppPath: vi.fn(() => process.cwd()),
      getName: vi.fn(() => "Agora"),
      getPath: vi.fn((name: string) =>
        name === "userData"
          ? testUserDataPath
          : path.join(os.tmpdir(), `agora-vitest-${name}`),
      ),
      getVersion: vi.fn(() => "0.0.0-test"),
      isPackaged: false,
      on: vi.fn(),
      once: vi.fn(),
      quit: vi.fn(),
      relaunch: vi.fn(),
      requestSingleInstanceLock: vi.fn(() => true),
      setAppUserModelId: vi.fn(),
      whenReady: vi.fn(async () => undefined),
    },
    BrowserWindow: MockBrowserWindow,
    Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
    Tray: vi.fn(),
    clipboard: { readText: vi.fn(() => ""), writeText: vi.fn() },
    contextBridge: { exposeInMainWorld: vi.fn() },
    dialog: {
      showErrorBox: vi.fn(),
      showMessageBox: vi.fn(async () => ({ response: 0 })),
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      showSaveDialog: vi.fn(async () => ({
        canceled: true,
        filePath: undefined,
      })),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeListener: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    },
    nativeImage: {
      createFromDataURL: vi.fn(() => ({})),
      createFromPath: vi.fn(() => ({})),
    },
    nativeTheme: { shouldUseDarkColors: false },
    net: { request: vi.fn() },
    powerMonitor: { on: vi.fn() },
    powerSaveBlocker: { start: vi.fn(() => 1), stop: vi.fn() },
    protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1280, height: 720 },
      })),
    },
    session: {
      defaultSession,
      fromPartition: vi.fn(() => defaultSession),
    },
    shell: {
      openExternal: vi.fn(async () => undefined),
      openPath: vi.fn(async () => ""),
      showItemInFolder: vi.fn(),
    },
    systemPreferences: { getMediaAccessStatus: vi.fn(() => "granted") },
  };
});
