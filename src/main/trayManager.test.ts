import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trayManagerTestState = vi.hoisted(() => {
  const app = {
    isPackaged: false,
    quit: vi.fn(),
  };
  const createdTrays: Array<{
    icon: unknown;
    listeners: Map<string, Array<(...args: unknown[]) => void>>;
    setToolTip: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    popUpContextMenu: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: unknown[]) => void;
  }> = [];
  const builtMenus: Array<{ template: Array<Record<string, unknown>> }> = [];
  const createdImages: Array<{
    path: string;
    setTemplateImage: ReturnType<typeof vi.fn>;
    getSize: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
  }> = [];
  const t = vi.fn((key: string) => key);

  class MockTray {
    icon: unknown;
    listeners: Map<string, Array<(...args: unknown[]) => void>>;
    setToolTip: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    popUpContextMenu: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;

    constructor(icon: unknown) {
      this.icon = icon;
      this.listeners = new Map();
      this.setToolTip = vi.fn();
      this.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const current = this.listeners.get(event) ?? [];
        current.push(listener);
        this.listeners.set(event, current);
        return this;
      });
      this.removeListener = vi.fn(
        (event: string, listener: (...args: unknown[]) => void) => {
          const current = this.listeners.get(event) ?? [];
          this.listeners.set(
            event,
            current.filter((entry) => entry !== listener),
          );
          return this;
        },
      );
      this.popUpContextMenu = vi.fn();
      this.destroy = vi.fn();
      createdTrays.push(this);
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }
  }

  return {
    app,
    createdTrays,
    builtMenus,
    createdImages,
    t,
    MockTray,
  };
});

vi.mock('electron', () => ({
  app: trayManagerTestState.app,
  Tray: trayManagerTestState.MockTray,
  Menu: {
    buildFromTemplate: vi.fn((template) => {
      const menu = { template };
      trayManagerTestState.builtMenus.push(menu);
      return menu;
    }),
  },
  nativeImage: {
    createFromPath: vi.fn((imagePath: string) => {
      const image = {
        path: imagePath,
        setTemplateImage: vi.fn(),
        getSize: vi.fn().mockReturnValue({ height: 16, width: 16 }),
        resize: vi.fn(function resize() {
          return this;
        }),
      };
      trayManagerTestState.createdImages.push(image);
      return image;
    }),
  },
}));

vi.mock('./i18n', () => ({
  t: trayManagerTestState.t,
}));

import { APP_NAME } from './appConstants';
import { createTray, destroyTray, updateTrayMenu } from './trayManager';

function createWindow(options: {
  destroyed?: boolean;
  visible?: boolean;
  focused?: boolean;
} = {}) {
  return {
    isDestroyed: vi.fn().mockReturnValue(options.destroyed ?? false),
    isVisible: vi.fn().mockReturnValue(options.visible ?? false),
    isFocused: vi.fn().mockReturnValue(options.focused ?? false),
    show: vi.fn(),
    focus: vi.fn(),
    webContents: {
      send: vi.fn(),
    },
  };
}

describe('trayManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trayManagerTestState.app.isPackaged = false;
    trayManagerTestState.createdTrays.length = 0;
    trayManagerTestState.builtMenus.length = 0;
    trayManagerTestState.createdImages.length = 0;
  });

  afterEach(() => {
    destroyTray();
  });

  it('creates a singleton tray, wires click handlers, and executes menu actions against the main window', () => {
    const mainWindow = createWindow();
    const getWindow = vi.fn().mockReturnValue(mainWindow);

    const firstTray = createTray(getWindow);
    const secondTray = createTray(getWindow);

    expect(firstTray).toBe(secondTray);
    expect(trayManagerTestState.createdTrays).toHaveLength(1);
    expect(trayManagerTestState.createdTrays[0]?.setToolTip).toHaveBeenCalledWith(
      APP_NAME,
    );
    expect(trayManagerTestState.t).toHaveBeenCalledWith('trayShowWindow');
    expect(trayManagerTestState.t).toHaveBeenCalledWith('trayNewTask');
    expect(trayManagerTestState.t).toHaveBeenCalledWith('traySettings');
    expect(trayManagerTestState.t).toHaveBeenCalledWith('trayQuit');

    trayManagerTestState.createdTrays[0]?.emit('click');
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);

    trayManagerTestState.createdTrays[0]?.emit('right-click');
    expect(trayManagerTestState.createdTrays[0]?.popUpContextMenu)
      .toHaveBeenCalledWith(trayManagerTestState.builtMenus[0]);

    const template = trayManagerTestState.builtMenus[0]?.template ?? [];
    (template[0]?.click as (() => void) | undefined)?.();
    (template[1]?.click as (() => void) | undefined)?.();
    (template[3]?.click as (() => void) | undefined)?.();
    (template[5]?.click as (() => void) | undefined)?.();

    expect(mainWindow.show).toHaveBeenCalledTimes(4);
    expect(mainWindow.focus).toHaveBeenCalledTimes(4);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('app:newTask');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      'app:openSettings',
    );
    expect(trayManagerTestState.app.quit).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the menu and tears down tray listeners on destroy', () => {
    const mainWindow = createWindow({
      visible: true,
      focused: true,
    });
    const getWindow = vi.fn().mockReturnValue(mainWindow);

    createTray(getWindow);
    updateTrayMenu(getWindow);

    expect(trayManagerTestState.builtMenus).toHaveLength(2);

    const tray = trayManagerTestState.createdTrays[0];
    destroyTray();

    expect(tray?.removeListener).toHaveBeenCalledTimes(2);
    expect(tray?.destroy).toHaveBeenCalledTimes(1);
  });

  it('ignores click/menu actions when no live window is available', () => {
    const destroyedWindow = createWindow({
      destroyed: true,
    });
    const getWindow = vi.fn().mockReturnValue(destroyedWindow);

    createTray(getWindow);
    trayManagerTestState.createdTrays[0]?.emit('click');
    const template = trayManagerTestState.builtMenus[0]?.template ?? [];
    (template[0]?.click as (() => void) | undefined)?.();
    (template[1]?.click as (() => void) | undefined)?.();
    (template[3]?.click as (() => void) | undefined)?.();

    expect(destroyedWindow.show).not.toHaveBeenCalled();
    expect(destroyedWindow.focus).not.toHaveBeenCalled();
    expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();
  });
});
