import type { App } from 'electron';

import { initLogger } from './logger';
import type {
  MainProcessEnvironment,
  MainProcessLifecycleDeps,
} from './mainProcessEnvironmentContract';
import {
  applyMainProcessCommandLineSwitches,
  resolveMainProcessEnvironmentFlags,
} from './mainProcessFlagSupport';
import {
  registerMainProcessLifecycleHandlers,
} from './mainProcessLifecycleSupport';
import {
  configureUserDataPath,
  normalizeShellPathForPlatform,
} from './mainProcessPathSupport';

export type {
  MainProcessEnvironment,
  MainProcessLifecycleDeps,
} from './mainProcessEnvironmentContract';
export { normalizeShellPathForPlatform } from './mainProcessPathSupport';

export function bootstrapMainProcessEnvironment(
  app: App,
): MainProcessEnvironment {
  configureUserDataPath(app);
  initLogger();

  const flags = resolveMainProcessEnvironmentFlags(process.env, process.platform);
  applyMainProcessCommandLineSwitches(app, flags);

  const registerLifecycleHandlers = (
    deps: MainProcessLifecycleDeps,
  ): void => {
    registerMainProcessLifecycleHandlers(app, deps, {
      reloadOnChildProcessGone: flags.reloadOnChildProcessGone,
      processApi: process,
    });
  };

  return {
    isDev: flags.isDev,
    isMac: flags.isMac,
    isWindows: flags.isWindows,
    devServerUrl: flags.devServerUrl,
    normalizeShellPath: (inputPath: string) =>
      normalizeShellPathForPlatform(inputPath, flags.isWindows),
    registerLifecycleHandlers,
  };
}
