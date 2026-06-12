import { createCoworkEngineRuntimeCompose } from './coworkEngineRuntimeComposeSupport';
import type {
  CoworkEngineRuntime,
  CoworkEngineRuntimeDeps,
} from './coworkEngineRuntimeContract';

export type {
  CoworkEngineRuntime,
  CoworkEngineRuntimeDeps,
} from './coworkEngineRuntimeContract';
export type { SyncOpenClawConfigResult } from './coworkEngineRuntimeContract';

export function createCoworkEngineRuntime(
  deps: CoworkEngineRuntimeDeps,
): CoworkEngineRuntime {
  return createCoworkEngineRuntimeCompose(deps);
}
