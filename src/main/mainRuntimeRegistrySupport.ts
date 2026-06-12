import { createMainRuntimeRegistrySupportCompose } from './mainRuntimeRegistrySupportComposeSupport';
import type {
  MainRuntimeRegistrySupport,
  MainRuntimeRegistrySupportDeps,
} from './mainRuntimeRegistrySupportContract';

export {
  createScheduledTaskIMGatewayManagerView,
} from './mainRuntimeRegistryScheduledTaskViewSupport';
export type {
  MainRuntimeRegistrySupport,
  MainRuntimeRegistrySupportDeps,
} from './mainRuntimeRegistrySupportContract';

export function createMainRuntimeRegistrySupport(
  deps: MainRuntimeRegistrySupportDeps,
): MainRuntimeRegistrySupport {
  return createMainRuntimeRegistrySupportCompose(deps);
}
