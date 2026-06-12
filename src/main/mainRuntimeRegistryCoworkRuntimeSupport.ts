import { createMainRuntimeRegistryCoworkRuntimeCompose } from './mainRuntimeRegistryCoworkRuntimeComposeSupport';
import type {
  MainRuntimeRegistryCoworkRuntimeSupport,
  MainRuntimeRegistryCoworkRuntimeSupportDeps,
} from './mainRuntimeRegistryCoworkRuntimeContract';

export type {
  MainRuntimeRegistryCoworkRuntimeSupport,
  MainRuntimeRegistryCoworkRuntimeSupportDeps,
} from './mainRuntimeRegistryCoworkRuntimeContract';

export function createMainRuntimeRegistryCoworkRuntimeSupport(
  deps: MainRuntimeRegistryCoworkRuntimeSupportDeps,
): MainRuntimeRegistryCoworkRuntimeSupport {
  return createMainRuntimeRegistryCoworkRuntimeCompose(deps);
}
