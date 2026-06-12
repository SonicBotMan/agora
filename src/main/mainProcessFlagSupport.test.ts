import { describe, expect, it, vi } from 'vitest';

import {
  applyMainProcessCommandLineSwitches,
  resolveMainProcessEnvironmentFlags,
} from './mainProcessFlagSupport';

describe('mainProcessFlagSupport', () => {
  it('resolves environment flags from env and platform', () => {
    expect(
      resolveMainProcessEnvironmentFlags(
        {
          NODE_ENV: 'development',
          ELECTRON_START_URL: 'http://localhost:9000',
          ELECTRON_ENABLE_LOGGING: 'true',
          LOBSTERAI_DISABLE_GPU: '1',
          ELECTRON_RELOAD_ON_CHILD_PROCESS_GONE: 'true',
        },
        'linux',
      ),
    ).toEqual({
      isDev: true,
      isLinux: true,
      isMac: false,
      isWindows: false,
      devServerUrl: 'http://localhost:9000',
      enableVerboseLogging: true,
      disableGpu: true,
      reloadOnChildProcessGone: true,
    });
  });

  it('applies process command line switches from flags', () => {
    const appendSwitch = vi.fn();
    const disableHardwareAcceleration = vi.fn();

    applyMainProcessCommandLineSwitches(
      {
        commandLine: { appendSwitch },
        disableHardwareAcceleration,
      } as never,
      {
        isLinux: true,
        isWindows: false,
        disableGpu: true,
        enableVerboseLogging: true,
      },
    );

    expect(appendSwitch).toHaveBeenCalledWith('no-sandbox');
    expect(appendSwitch).toHaveBeenCalledWith('disable-dev-shm-usage');
    expect(appendSwitch).toHaveBeenCalledWith('disable-gpu');
    expect(appendSwitch).toHaveBeenCalledWith('disable-software-rasterizer');
    expect(appendSwitch).toHaveBeenCalledWith('enable-logging');
    expect(appendSwitch).toHaveBeenCalledWith('v', '1');
    expect(disableHardwareAcceleration).toHaveBeenCalled();
  });
});
