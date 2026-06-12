import { registerAllHandlers } from './ipc';
import { createMainIpcAuthTokenAccessors } from './mainIpcBootstrapAuthSupport';
import type {
  MainIpcBootstrapDeps,
  MainIpcBootstrapResult,
} from './mainIpcBootstrapContract';
import { registerNetworkStatusChangeListener } from './mainIpcBootstrapSupport';

export type {
  MainIpcAuthRuntimeDeps,
  MainIpcBootstrapDeps,
  MainIpcBootstrapInputDeps,
  MainIpcBootstrapResult,
} from './mainIpcBootstrapContract';

export function registerMainIpcBootstrap(
  deps: MainIpcBootstrapDeps,
): MainIpcBootstrapResult {
  registerNetworkStatusChangeListener(deps.onNetworkOnline);
  registerAllHandlers(deps.handlers);
  return createMainIpcAuthTokenAccessors(deps.handlers.auth);
}
