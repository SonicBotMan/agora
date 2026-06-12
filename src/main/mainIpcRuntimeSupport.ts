import type {
  MainIpcRuntimeBuilderDeps,
  MainIpcRuntimeHandlerDeps,
} from './mainIpcRuntimeContract';
import { createMainIpcRuntimeImHandlerDeps } from './mainIpcRuntimeImSupport';
import { createMainIpcRuntimeServiceHandlerDeps } from './mainIpcRuntimeServiceSupport';
import { createMainIpcRuntimeSessionHandlerDeps } from './mainIpcRuntimeSessionSupport';

export type {
  MainIpcRuntimeBuilderDeps,
  MainIpcRuntimeHandlerDeps,
} from './mainIpcRuntimeContract';

export function createMainIpcRuntimeHandlerDeps(
  deps: MainIpcRuntimeBuilderDeps,
): MainIpcRuntimeHandlerDeps {
  return {
    sessions: createMainIpcRuntimeSessionHandlerDeps(deps),
    im: createMainIpcRuntimeImHandlerDeps(deps),
    ...createMainIpcRuntimeServiceHandlerDeps(deps),
  };
}
