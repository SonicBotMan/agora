import { describe, expect, it, vi } from 'vitest';

import {
  createReloadScheduler,
  emitMainWindowState,
} from './mainWindowStateSupport';

describe('mainWindowStateSupport', () => {
  it('emits current window state to renderer', () => {
    const send = vi.fn();
    const mainWindow = {
      isDestroyed: () => false,
      isMaximized: () => true,
      isFullScreen: () => false,
      isFocused: () => true,
      webContents: {
        isDestroyed: () => false,
        send,
      },
    };

    emitMainWindowState(mainWindow as never);

    expect(send).toHaveBeenCalledWith('window:state-changed', {
      isMaximized: true,
      isFullscreen: false,
      isFocused: true,
    });
  });

  it('skips emit when webContents is destroyed', () => {
    const send = vi.fn();
    const mainWindow = {
      isDestroyed: () => false,
      isMaximized: () => false,
      isFullScreen: () => false,
      isFocused: () => false,
      webContents: {
        isDestroyed: () => true,
        send,
      },
    };

    emitMainWindowState(mainWindow as never);

    expect(send).not.toHaveBeenCalled();
  });

  it('reloads and throttles rapid repeat reload requests', () => {
    const reloadIgnoringCache = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(10_000)
      .mockReturnValueOnce(12_000)
      .mockReturnValueOnce(16_500);

    const scheduler = createReloadScheduler(() => ({
      webContents: {
        isDestroyed: () => false,
        reloadIgnoringCache,
      },
    }) as never);

    scheduler('first');
    scheduler('second');
    scheduler('third');

    expect(reloadIgnoringCache).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith('Reloading window due to first');
    expect(warnSpy).toHaveBeenCalledWith(
      'Skipping reload (second); last reload was 2000ms ago.',
    );
    expect(warnSpy).toHaveBeenCalledWith('Reloading window due to third');

    warnSpy.mockRestore();
    nowSpy.mockRestore();
  });
});
