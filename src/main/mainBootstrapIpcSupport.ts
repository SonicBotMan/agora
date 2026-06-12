import { createMainIpcCoreBuilderDeps } from './mainBootstrapIpcCoreSupport';
import { createMainIpcRuntimeBuilderDeps } from './mainBootstrapIpcRuntimeSupport';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { MainIpcBootstrapInputDeps } from './mainIpcBootstrap';
import { createMainIpcCoreHandlerDeps } from './mainIpcCoreSupport';
import { createMainIpcRuntimeHandlerDeps } from './mainIpcRuntimeSupport';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrap';

export function createMainIpcBootstrapDeps(
  deps: MainBootstrapWiringDeps,
): SingleInstanceAppBootstrapDeps['mainIpc'] {
  const coreBuilderDeps = createMainIpcCoreBuilderDeps(deps);
  const runtimeBuilderDeps = createMainIpcRuntimeBuilderDeps(deps);
  const getStoreValue: MainIpcBootstrapInputDeps['handlers']['getStore'] = (
    key,
    defaultValue,
  ) => {
    const value = deps.runtime.getStore().get(key);
    return (value === undefined ? defaultValue : value) as never;
  };

  return {
    onNetworkOnline: coreBuilderDeps.onNetworkOnline,
    handlers: {
      ...createMainIpcCoreHandlerDeps(coreBuilderDeps, getStoreValue),
      ...createMainIpcRuntimeHandlerDeps(runtimeBuilderDeps),
    },
  };
}
