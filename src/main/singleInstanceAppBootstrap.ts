import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrapContract';
import { runSingleInstanceAppBootstrap } from './singleInstanceAppBootstrapRuntimeSupport';

export type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrapContract';

export function bootstrapSingleInstanceApp(
  deps: SingleInstanceAppBootstrapDeps,
): void {
  const gotTheLock = deps.app.requestSingleInstanceLock();

  if (!gotTheLock) {
    deps.app.quit();
    return;
  }
  runSingleInstanceAppBootstrap(deps);
}
