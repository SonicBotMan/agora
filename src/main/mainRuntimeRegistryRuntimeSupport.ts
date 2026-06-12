import { createMainRuntimeRegistryRuntimeCompose } from './mainRuntimeRegistryRuntimeComposeSupport';
import type {
  MainRuntimeRegistryRuntimeSupport,
  MainRuntimeRegistryRuntimeSupportDeps,
} from './mainRuntimeRegistryRuntimeContract';

export type {
  MainRuntimeRegistryRuntimeSupport,
  MainRuntimeRegistryRuntimeSupportDeps,
} from './mainRuntimeRegistryRuntimeContract';

export function createMainRuntimeRegistryRuntimeSupport(
  deps: MainRuntimeRegistryRuntimeSupportDeps,
): MainRuntimeRegistryRuntimeSupport {
  return createMainRuntimeRegistryRuntimeCompose(deps);
}
