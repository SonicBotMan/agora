import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrap';

export function createScheduledTaskStartupDeps(
  deps: MainBootstrapWiringDeps,
): SingleInstanceAppBootstrapDeps['scheduledTaskStartup'] {
  return {
    getIMGatewayManager: deps.runtime.getScheduledTaskIMGatewayManager,
    getOpenClawRuntimeAdapter: deps.runtime.peekOpenClawRuntimeAdapter,
  };
}
