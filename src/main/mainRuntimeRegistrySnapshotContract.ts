import type { BrowserWindow } from 'electron';

import type { CoworkSessionRuntimeSnapshot } from '../shared/cowork/runtimeSnapshot';
import type { CoworkRuntimeForwarder } from './coworkRuntimeForwarder';
import type { CoworkRuntimeSnapshotRuntime } from './coworkRuntimeSnapshot';
import type { CoworkStore } from './coworkStore';
import type { CoworkAgentEngine, CoworkEngineRouter } from './libs/agentEngine';
import type { SqliteStore } from './sqliteStore';

export interface MainRuntimeRegistrySnapshotSupportDeps {
  getWindows: () => BrowserWindow[];
  getStore: () => SqliteStore;
  getCoworkStore: () => CoworkStore;
  getCoworkEngineRouter: () => CoworkEngineRouter;
}

export interface MainRuntimeRegistrySnapshotSupport {
  getCoworkRuntimeForwarder: () => CoworkRuntimeForwarder;
  peekCoworkRuntimeForwarder: () => CoworkRuntimeForwarder | null;
  getExternalAgentProviderStore: () => ReturnType<
    CoworkRuntimeSnapshotRuntime['getExternalAgentProviderStore']
  >;
  getRuntimeTelemetryStore: () => ReturnType<
    CoworkRuntimeSnapshotRuntime['getRuntimeTelemetryStore']
  >;
  resolveSessionRuntimeSnapshot: (
    engine: CoworkAgentEngine,
  ) => CoworkSessionRuntimeSnapshot;
  prepareRuntimeSnapshotForTurn: (
    snapshot?: CoworkSessionRuntimeSnapshot | null,
  ) => void;
  getRuntimeTelemetryTracker: () => ReturnType<
    CoworkRuntimeSnapshotRuntime['getRuntimeTelemetryTracker']
  >;
}
