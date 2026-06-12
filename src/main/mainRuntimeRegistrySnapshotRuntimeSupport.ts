import type { CoworkRuntimeSnapshotRuntime } from './coworkRuntimeSnapshot';
import { createCoworkRuntimeSnapshot } from './coworkRuntimeSnapshot';
import type {
  MainRuntimeRegistrySnapshotSupport,
  MainRuntimeRegistrySnapshotSupportDeps,
} from './mainRuntimeRegistrySnapshotContract';

type MainRuntimeRegistrySnapshotRuntimeSupport = Pick<
  MainRuntimeRegistrySnapshotSupport,
  | 'getExternalAgentProviderStore'
  | 'getRuntimeTelemetryStore'
  | 'resolveSessionRuntimeSnapshot'
  | 'prepareRuntimeSnapshotForTurn'
  | 'getRuntimeTelemetryTracker'
>;

export function createMainRuntimeRegistrySnapshotRuntimeSupport(
  deps: MainRuntimeRegistrySnapshotSupportDeps,
): MainRuntimeRegistrySnapshotRuntimeSupport {
  let coworkRuntimeSnapshotRuntime: CoworkRuntimeSnapshotRuntime | null = null;

  const getCoworkRuntimeSnapshotRuntime = (): CoworkRuntimeSnapshotRuntime => {
    if (!coworkRuntimeSnapshotRuntime) {
      coworkRuntimeSnapshotRuntime = createCoworkRuntimeSnapshot({
        getStore: deps.getStore,
        getCoworkStore: deps.getCoworkStore,
      });
    }
    return coworkRuntimeSnapshotRuntime;
  };

  const getExternalAgentProviderStore = () =>
    getCoworkRuntimeSnapshotRuntime().getExternalAgentProviderStore();

  const getRuntimeTelemetryStore = () =>
    getCoworkRuntimeSnapshotRuntime().getRuntimeTelemetryStore();

  const resolveSessionRuntimeSnapshot: MainRuntimeRegistrySnapshotSupport['resolveSessionRuntimeSnapshot'] = (
    engine,
  ) =>
    getCoworkRuntimeSnapshotRuntime().resolveSessionRuntimeSnapshot(engine);

  const prepareRuntimeSnapshotForTurn: MainRuntimeRegistrySnapshotSupport['prepareRuntimeSnapshotForTurn'] = (
    snapshot,
  ): void => {
    getCoworkRuntimeSnapshotRuntime().prepareRuntimeSnapshotForTurn(snapshot);
  };

  const getRuntimeTelemetryTracker = () =>
    getCoworkRuntimeSnapshotRuntime().getRuntimeTelemetryTracker();

  return {
    getExternalAgentProviderStore,
    getRuntimeTelemetryStore,
    resolveSessionRuntimeSnapshot,
    prepareRuntimeSnapshotForTurn,
    getRuntimeTelemetryTracker,
  };
}
