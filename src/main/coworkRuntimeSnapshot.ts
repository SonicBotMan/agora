import {
  ExternalAgentConfigSource,
} from '../shared/cowork/constants';
import type { CoworkSessionRuntimeSnapshot } from '../shared/cowork/runtimeSnapshot';
import {
  getApiOverrideFromRuntimeSnapshot,
  getClaudeCodePermissionLabel,
  getConfigSourceForEngine,
  getEngineSnapshotLabel,
  getExternalProviderAppTypeForEngine,
} from './coworkRuntimeSnapshotSupport';
import type { CoworkStore } from './coworkStore';
import type { CoworkAgentEngine } from './libs/agentEngine';
import { resolveCurrentApiConfig } from './libs/claudeSettings';
import {
  ExternalAgentProviderStore,
} from './libs/externalAgentProviderStore';
import {
  type RuntimeModelSnapshot,
  RuntimeTelemetryTracker,
} from './libs/runtimeTelemetryTracker';
import { RuntimeTelemetryStore } from './runtimeTelemetryStore';
import type { SqliteStore } from './sqliteStore';

export interface CoworkRuntimeSnapshotDeps {
  getStore: () => SqliteStore;
  getCoworkStore: () => CoworkStore;
}

export interface CoworkRuntimeSnapshotRuntime {
  getExternalAgentProviderStore: () => ExternalAgentProviderStore;
  getRuntimeTelemetryStore: () => RuntimeTelemetryStore;
  getRuntimeTelemetryTracker: () => RuntimeTelemetryTracker;
  resolveSessionRuntimeSnapshot: (
    engine: CoworkAgentEngine,
  ) => CoworkSessionRuntimeSnapshot;
  prepareRuntimeSnapshotForTurn: (
    snapshot?: CoworkSessionRuntimeSnapshot | null,
  ) => void;
}

export function createCoworkRuntimeSnapshot(
  deps: CoworkRuntimeSnapshotDeps,
): CoworkRuntimeSnapshotRuntime {
  let externalAgentProviderStore: ExternalAgentProviderStore | null = null;
  let runtimeTelemetryStore: RuntimeTelemetryStore | null = null;
  let runtimeTelemetryTracker: RuntimeTelemetryTracker | null = null;

  const getExternalAgentProviderStore = (): ExternalAgentProviderStore => {
    if (!externalAgentProviderStore) {
      externalAgentProviderStore = new ExternalAgentProviderStore(
        deps.getStore().getDatabase(),
      );
    }
    return externalAgentProviderStore;
  };

  const getRuntimeTelemetryStore = (): RuntimeTelemetryStore => {
    if (!runtimeTelemetryStore) {
      runtimeTelemetryStore = new RuntimeTelemetryStore(
        deps.getStore().getDatabase(),
      );
    }
    return runtimeTelemetryStore;
  };

  const resolveRuntimeModelSnapshot = (
    engine: CoworkAgentEngine,
  ): RuntimeModelSnapshot => {
    const configSource = getConfigSourceForEngine(
      engine,
      deps.getCoworkStore().getConfig(),
    );
    const appType = getExternalProviderAppTypeForEngine(engine);
    if (appType && configSource === ExternalAgentConfigSource.LocalCli) {
      const provider = getExternalAgentProviderStore().getCurrentProvider(appType);
      return {
        providerKey: provider?.id ?? null,
        providerName: provider?.name ?? null,
        modelId: provider?.summary.model?.trim() || null,
        modelName: provider?.summary.model?.trim() || null,
        configSource,
      };
    }

    try {
      const resolution = resolveCurrentApiConfig();
      return {
        providerKey: resolution.providerMetadata?.providerName ?? null,
        providerName: resolution.providerMetadata?.providerName ?? null,
        modelId: resolution.config?.model ?? null,
        modelName:
          resolution.providerMetadata?.modelName
          ?? resolution.config?.model
          ?? null,
        configSource,
      };
    } catch {
      return {
        providerKey: null,
        providerName: null,
        modelId: null,
        modelName: null,
        configSource,
      };
    }
  };

  const resolveSessionRuntimeSnapshot = (
    engine: CoworkAgentEngine,
  ): CoworkSessionRuntimeSnapshot => {
    const model = resolveRuntimeModelSnapshot(engine);
    const config = deps.getCoworkStore().getConfig();
    const permissionMode =
      engine === 'claude_code'
        ? config.claudeCodePermissionMode
        : null;
    const modelLabel = [model.providerName, model.modelName || model.modelId]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' · ');

    return {
      agentEngine: engine,
      engineLabel: getEngineSnapshotLabel(engine),
      providerKey: model.providerKey,
      providerName: model.providerName,
      modelId: model.modelId,
      modelName: model.modelName,
      modelLabel: modelLabel || 'Unknown model',
      configSource: model.configSource,
      permissionMode,
      permissionModeLabel: getClaudeCodePermissionLabel(permissionMode),
      capturedAt: Date.now(),
    };
  };

  const restoreRuntimeSnapshotProvider = (
    snapshot?: CoworkSessionRuntimeSnapshot | null,
  ): void => {
    if (
      !snapshot
      || snapshot.configSource !== ExternalAgentConfigSource.LocalCli
      || !snapshot.providerKey
    ) {
      return;
    }
    const appType = getExternalProviderAppTypeForEngine(snapshot.agentEngine);
    if (!appType) return;
    try {
      getExternalAgentProviderStore().setCurrentProvider(
        appType,
        snapshot.providerKey,
      );
    } catch (error) {
      console.warn(
        '[CoworkRuntime] failed to restore locked local provider:',
        error,
      );
    }
  };

  const configureRuntimeSnapshotProxy = (
    snapshot?: CoworkSessionRuntimeSnapshot | null,
  ): void => {
    const override = getApiOverrideFromRuntimeSnapshot(snapshot);
    if (!override) return;
    try {
      resolveCurrentApiConfig('local', override);
    } catch (error) {
      console.warn(
        '[CoworkRuntime] failed to configure locked model proxy:',
        error,
      );
    }
  };

  const prepareRuntimeSnapshotForTurn = (
    snapshot?: CoworkSessionRuntimeSnapshot | null,
  ): void => {
    restoreRuntimeSnapshotProvider(snapshot);
    configureRuntimeSnapshotProxy(snapshot);
  };

  const getRuntimeTelemetryTracker = (): RuntimeTelemetryTracker => {
    if (!runtimeTelemetryTracker) {
      runtimeTelemetryTracker = new RuntimeTelemetryTracker({
        store: deps.getCoworkStore(),
        telemetryStore: getRuntimeTelemetryStore(),
        getModelSnapshot: resolveRuntimeModelSnapshot,
      });
    }
    return runtimeTelemetryTracker;
  };

  return {
    getExternalAgentProviderStore,
    getRuntimeTelemetryStore,
    getRuntimeTelemetryTracker,
    resolveSessionRuntimeSnapshot,
    prepareRuntimeSnapshotForTurn,
  };
}
