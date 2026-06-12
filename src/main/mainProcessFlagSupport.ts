import type {
  MainProcessApp,
  MainProcessEnvironmentFlags,
} from './mainProcessEnvironmentContract';

export function resolveMainProcessEnvironmentFlags(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): MainProcessEnvironmentFlags {
  return {
    isDev: env.NODE_ENV === 'development',
    isLinux: platform === 'linux',
    isMac: platform === 'darwin',
    isWindows: platform === 'win32',
    devServerUrl: env.ELECTRON_START_URL || 'http://localhost:5175',
    enableVerboseLogging:
      env.ELECTRON_ENABLE_LOGGING === '1'
      || env.ELECTRON_ENABLE_LOGGING === 'true',
    disableGpu:
      env.LOBSTERAI_DISABLE_GPU === '1'
      || env.LOBSTERAI_DISABLE_GPU === 'true'
      || env.ELECTRON_DISABLE_GPU === '1'
      || env.ELECTRON_DISABLE_GPU === 'true',
    reloadOnChildProcessGone:
      env.ELECTRON_RELOAD_ON_CHILD_PROCESS_GONE === '1'
      || env.ELECTRON_RELOAD_ON_CHILD_PROCESS_GONE === 'true',
  };
}

export function applyMainProcessCommandLineSwitches(
  app: Pick<MainProcessApp, 'commandLine' | 'disableHardwareAcceleration'>,
  flags: Pick<
    MainProcessEnvironmentFlags,
    'isLinux' | 'isWindows' | 'disableGpu' | 'enableVerboseLogging'
  >,
): void {
  if (flags.isLinux || flags.isWindows) {
    app.commandLine.appendSwitch('no-sandbox');
  }
  if (flags.isLinux) {
    app.commandLine.appendSwitch('disable-dev-shm-usage');
  }
  if (flags.disableGpu) {
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.disableHardwareAcceleration();
  }
  if (flags.enableVerboseLogging) {
    app.commandLine.appendSwitch('enable-logging');
    app.commandLine.appendSwitch('v', '1');
  }
}
