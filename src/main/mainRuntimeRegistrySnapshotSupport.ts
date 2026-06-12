import type {
  MainRuntimeRegistrySnapshotSupport,
  MainRuntimeRegistrySnapshotSupportDeps,
} from './mainRuntimeRegistrySnapshotContract';
import { createMainRuntimeRegistrySnapshotForwarderSupport } from './mainRuntimeRegistrySnapshotForwarderSupport';
import { createMainRuntimeRegistrySnapshotRuntimeSupport } from './mainRuntimeRegistrySnapshotRuntimeSupport';

export type {
  MainRuntimeRegistrySnapshotSupport,
  MainRuntimeRegistrySnapshotSupportDeps,
} from './mainRuntimeRegistrySnapshotContract';

export function createMainRuntimeRegistrySnapshotSupport(
  deps: MainRuntimeRegistrySnapshotSupportDeps,
): MainRuntimeRegistrySnapshotSupport {
  const forwarderSupport =
    createMainRuntimeRegistrySnapshotForwarderSupport(deps);
  const snapshotRuntimeSupport =
    createMainRuntimeRegistrySnapshotRuntimeSupport(deps);

  return {
    ...forwarderSupport,
    ...snapshotRuntimeSupport,
  };
}
