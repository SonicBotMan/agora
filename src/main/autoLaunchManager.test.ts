import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const autoLaunchManagerTestState = vi.hoisted(() => {
  const app = {
    getLoginItemSettings: vi.fn(),
    setLoginItemSettings: vi.fn(),
  };

  return {
    app,
  };
});

vi.mock('electron', () => ({
  app: autoLaunchManagerTestState.app,
}));

import {
  getAutoLaunchEnabled,
  isAutoLaunched,
  setAutoLaunchEnabled,
} from './autoLaunchManager';

describe('autoLaunchManager', () => {
  const originalPlatform = process.platform;
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    process.argv = [...originalArgv];
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    process.argv = originalArgv;
  });

  it('reads auto-launch state using the Windows-compatible login item args', () => {
    autoLaunchManagerTestState.app.getLoginItemSettings.mockReturnValue({
      openAtLogin: true,
    });

    expect(getAutoLaunchEnabled()).toBe(true);
    expect(
      autoLaunchManagerTestState.app.getLoginItemSettings,
    ).toHaveBeenCalledWith({
      args: ['--auto-launched'],
    });
  });

  it('returns false when auto-launch state lookup fails', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    autoLaunchManagerTestState.app.getLoginItemSettings.mockImplementation(() => {
      throw new Error('lookup-failed');
    });

    expect(getAutoLaunchEnabled()).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to get auto-launch settings:',
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('writes login item settings with mac hidden-launch behavior and Windows args', () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });

    setAutoLaunchEnabled(true);
    expect(
      autoLaunchManagerTestState.app.setLoginItemSettings,
    ).toHaveBeenCalledWith({
      openAtLogin: true,
      openAsHidden: true,
      args: ['--auto-launched'],
    });

    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    setAutoLaunchEnabled(false);
    expect(
      autoLaunchManagerTestState.app.setLoginItemSettings,
    ).toHaveBeenLastCalledWith({
      openAtLogin: false,
      openAsHidden: false,
      args: [],
    });
  });

  it('detects auto-launched startup from mac login-item state or Windows argv and falls back safely on errors', () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
    autoLaunchManagerTestState.app.getLoginItemSettings.mockReturnValue({
      wasOpenedAtLogin: true,
    });
    expect(isAutoLaunched()).toBe(true);

    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    process.argv = ['electron', 'main.js', '--auto-launched'];
    expect(isAutoLaunched()).toBe(true);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    autoLaunchManagerTestState.app.getLoginItemSettings.mockImplementation(() => {
      throw new Error('status-failed');
    });
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
    expect(isAutoLaunched()).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to check auto-launch status:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});
