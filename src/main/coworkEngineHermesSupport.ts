import type { BrowserWindow } from 'electron';
import os from 'os';

import {
  CoworkAgentEngine as CoworkAgentEngineValue,
} from '../shared/cowork/constants';
import {
  FeishuEngineKey,
  type FeishuEngineKeyType,
  type FeishuRuntimeOwnershipType,
} from '../shared/im/constants';
import type { CoworkRuntimeForwarder } from './coworkRuntimeForwarder';
import type { CoworkStore } from './coworkStore';
import type { IMGatewayManager } from './im';
import type { CoworkAgentEngine } from './libs/agentEngine';
import { HermesConfigSync } from './libs/hermesConfigSync';
import {
  HermesEngineManager,
  type HermesEngineStatus,
} from './libs/hermesEngineManager';
import { syncHermesIMSessions } from './libs/hermesImSessionSync';

export interface HermesEngineSupportDeps {
  getWindows: () => BrowserWindow[];
  getCoworkStore: () => CoworkStore;
  getIMGatewayManager: () => IMGatewayManager;
  getFeishuRuntimeOwnership: (
    engineKey: FeishuEngineKeyType,
  ) => FeishuRuntimeOwnershipType;
  getCoworkRuntimeForwarder: () => CoworkRuntimeForwarder;
  resolveFeishuIMAgentEngine: () => CoworkAgentEngine;
}

export interface HermesEngineSupport {
  peekHermesEngineManager: () => HermesEngineManager | null;
  getHermesEngineManager: () => HermesEngineManager;
  getHermesConfigSync: () => HermesConfigSync;
  bindHermesStatusForwarder: () => void;
  bootstrapHermesEngine: (options?: {
    forceReinstall?: boolean;
    reason?: string;
  }) => Promise<HermesEngineStatus>;
  ensureHermesRunningForCowork: () => Promise<HermesEngineStatus>;
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
  startHermesIMSessionSyncPolling: () => void;
  stopHermesIMSessionSyncPolling: () => void;
}

const HERMES_IM_SESSION_SYNC_INTERVAL_MS = 4_000;

export function createHermesEngineSupport(
  deps: HermesEngineSupportDeps,
): HermesEngineSupport {
  let hermesEngineManager: HermesEngineManager | null = null;
  let hermesConfigSync: HermesConfigSync | null = null;
  let hermesBootstrapPromise: Promise<HermesEngineStatus> | null = null;
  let hermesStatusForwarderBound = false;
  let hermesIMSessionSyncTimer: ReturnType<typeof setInterval> | null = null;
  let hermesIMSessionSyncRunning = false;
  let hermesIMSessionSyncFingerprint = '';

  const broadcastHermesStatus = (
    status: HermesEngineStatus,
  ): void => {
    deps.getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send('hermes:engine:onProgress', status);
      } catch (error) {
        console.error(
          'Failed to forward Hermes Agent engine status:',
          error,
        );
      }
    });
  };

  const getHermesEngineManager = (): HermesEngineManager => {
    if (!hermesEngineManager) {
      hermesEngineManager = new HermesEngineManager();
    }
    return hermesEngineManager;
  };

  const getHermesConfigSync = (): HermesConfigSync => {
    if (!hermesConfigSync) {
      hermesConfigSync = new HermesConfigSync({
        engineManager: getHermesEngineManager(),
        getCoworkConfig: () => deps.getCoworkStore().getConfig(),
        getFeishuInstances: () => {
          try {
            return deps
              .getIMGatewayManager()
              .getIMStore()
              .getFeishuInstances(FeishuEngineKey.Hermes);
          } catch {
            return [];
          }
        },
        getFeishuRuntimeOwnership: () =>
          deps.getFeishuRuntimeOwnership(FeishuEngineKey.Hermes),
      });
    }
    return hermesConfigSync;
  };

  const bindHermesStatusForwarder = (): void => {
    if (hermesStatusForwarderBound) return;
    const manager = getHermesEngineManager();
    manager.on('status', (status) => {
      broadcastHermesStatus(status);
    });
    hermesStatusForwarderBound = true;
    broadcastHermesStatus(manager.getStatus());
  };

  const bootstrapHermesEngine = async (
    options: { forceReinstall?: boolean; reason?: string } = {},
  ): Promise<HermesEngineStatus> => {
    if (hermesBootstrapPromise) {
      return hermesBootstrapPromise;
    }

    const manager = getHermesEngineManager();
    bindHermesStatusForwarder();

    const task = async (): Promise<HermesEngineStatus> => {
      const reason = options.reason || 'unknown';
      try {
        const syncResult = getHermesConfigSync().sync(`bootstrap:${reason}`);
        if (!syncResult.success) {
          return syncResult.status || manager.getStatus();
        }
        if (options.forceReinstall) {
          await manager.stopGateway();
        }
        const ensuredStatus = await manager.ensureReady();
        if (
          ensuredStatus.phase !== 'ready'
          && ensuredStatus.phase !== 'running'
        ) {
          return ensuredStatus;
        }
        return await manager.startGateway();
      } catch (error) {
        console.error(`[Hermes] bootstrap failed (${reason}):`, error);
        return manager.getStatus();
      }
    };

    const promise = task().finally(() => {
      if (hermesBootstrapPromise === promise) {
        hermesBootstrapPromise = null;
      }
    });
    hermesBootstrapPromise = promise;
    return promise;
  };

  const ensureHermesRunningForCowork = async (): Promise<HermesEngineStatus> => {
    bindHermesStatusForwarder();
    const manager = getHermesEngineManager();
    const status = manager.getStatus();
    const syncResult = getHermesConfigSync().sync('ensureRunning');
    if (!syncResult.success) {
      console.error(
        '[Hermes] ensureRunning: config sync failed:',
        syncResult.error,
      );
      return syncResult.status || manager.getStatus();
    }
    if (status.phase === 'running') {
      if (syncResult.changed) {
        return await manager.restartGateway();
      }
      return manager.getStatus();
    }
    if (status.phase === 'starting') {
      return await manager.startGateway();
    }
    return await manager.startGateway();
  };

  const shouldSyncHermesIMSessions = (): boolean => {
    if (deps.resolveFeishuIMAgentEngine() !== CoworkAgentEngineValue.Hermes) {
      return false;
    }
    try {
      const config = deps.getIMGatewayManager().getConfig();
      return Boolean(
        config.feishu?.instances?.some(
          (instance) => instance.enabled && instance.appId && instance.appSecret,
        ),
      );
    } catch {
      return false;
    }
  };

  const syncHermesIMSessionsToCowork = async (
    reason: string,
  ): Promise<void> => {
    if (hermesIMSessionSyncRunning) {
      return;
    }
    hermesIMSessionSyncRunning = true;
    try {
      if (!shouldSyncHermesIMSessions()) {
        return;
      }
      const coworkConfig = deps.getCoworkStore().getConfig();
      const result = syncHermesIMSessions({
        coworkStore: deps.getCoworkStore(),
        imStore: deps.getIMGatewayManager().getIMStore(),
        cwd: coworkConfig.workingDirectory || os.homedir(),
        systemPrompt: coworkConfig.systemPrompt,
        executionMode: coworkConfig.executionMode,
        agentId: 'main',
      });

      const fingerprint = [
        result.importedSessions,
        result.importedMessages,
        result.latestUpdatedAt,
      ].join(':');
      if (result.changed && fingerprint !== hermesIMSessionSyncFingerprint) {
        hermesIMSessionSyncFingerprint = fingerprint;
        console.log(
          `[HermesIM] synced ${result.importedSessions} session(s) and ${result.importedMessages} message(s) (${reason})`,
        );
        deps.getCoworkRuntimeForwarder().broadcastSessionsChanged();
      }
    } catch (error) {
      console.warn('[HermesIM] session sync failed:', error);
    } finally {
      hermesIMSessionSyncRunning = false;
    }
  };

  const startHermesIMSessionSyncPolling = (): void => {
    if (hermesIMSessionSyncTimer) {
      return;
    }
    hermesIMSessionSyncTimer = setInterval(() => {
      void syncHermesIMSessionsToCowork('poll');
    }, HERMES_IM_SESSION_SYNC_INTERVAL_MS);
    void syncHermesIMSessionsToCowork('start');
  };

  const stopHermesIMSessionSyncPolling = (): void => {
    if (!hermesIMSessionSyncTimer) {
      return;
    }
    clearInterval(hermesIMSessionSyncTimer);
    hermesIMSessionSyncTimer = null;
  };

  return {
    peekHermesEngineManager: () => hermesEngineManager,
    getHermesEngineManager,
    getHermesConfigSync,
    bindHermesStatusForwarder,
    bootstrapHermesEngine,
    ensureHermesRunningForCowork,
    syncHermesIMSessionsToCowork,
    startHermesIMSessionSyncPolling,
    stopHermesIMSessionSyncPolling,
  };
}
