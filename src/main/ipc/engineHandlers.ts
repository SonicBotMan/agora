/**
 * Agora — Engine IPC Handlers
 *
 * Extracted from main.ts (lines ~3239–3439).
 * Per-engine adapter management: OpenClaw and Hermes Agent.
 * Each engine has 4 handlers: getStatus, install, retryInstall, restartGateway.
 */

import { ipcMain } from 'electron';

import { ExternalAgentConfigSource } from '../../shared/cowork/constants';
import type { ExternalAgentCliInstallResult } from '../libs/externalAgentCliInstaller';
import type { HermesConfigSyncResult } from '../libs/hermesConfigSync';
import type { HermesEngineStatus } from '../libs/hermesEngineManager';
import type { OpenClawEngineStatus } from '../libs/openclawEngineManager';

// ── Module-level state (migrated from main.ts closures) ──────────────────

let restartGatewayPromise: Promise<OpenClawEngineStatus> | null = null;
let restartHermesGatewayPromise: Promise<HermesEngineStatus> | null = null;

// ── Dependency Interface ─────────────────────────────────────────────────

export interface EngineDeps {
  /** OpenClaw engine manager — gateway lifecycle, status, install orchestration. */
  getOpenClawEngineManager: () => {
    getStatus: () => OpenClawEngineStatus;
    ensureReady: () => Promise<OpenClawEngineStatus>;
    restartGateway: () => Promise<OpenClawEngineStatus>;
  };

  /** Hermes Agent engine manager — gateway lifecycle, status, install orchestration. */
  getHermesEngineManager: () => {
    getStatus: () => HermesEngineStatus;
    ensureReady: () => Promise<HermesEngineStatus>;
    restartGateway: () => Promise<HermesEngineStatus>;
  };

  /** Cowork (workspace) store — used to set hermesConfigSource on install. */
  getCoworkStore: () => {
    setConfig: (config: { hermesConfigSource?: unknown }) => void;
  };

  /** External agent CLI installer — handles 'openclaw' / 'hermes' install flows. */
  getExternalAgentCliInstaller: () => {
    install: (appType: string) => Promise<ExternalAgentCliInstallResult>;
  };

  /** Binds the external agent CLI installer progress forwarder (side-effect, called before install). */
  bindExternalAgentCliInstallerForwarder: () => void;

  /** Hermes config sync — writes environment config before gateway restart. */
  getHermesConfigSync: () => {
    sync: (reason: string) => HermesConfigSyncResult;
  };

  /**
   * Bootstrap function for Hermes engine (calls config sync, ensureReady, startGateway).
   * Defined in main.ts as a module-level closure.
   */
  bootstrapHermesEngine: (options: {
    forceReinstall: boolean;
    reason: string;
  }) => Promise<HermesEngineStatus>;
}

// ── Handlers ─────────────────────────────────────────────────────────────

export function registerEngineHandlers(deps: EngineDeps): void {
  // ── OpenClaw Engine ───────────────────────────────────────────────────

  ipcMain.handle('openclaw:engine:getStatus', async () => {
    try {
      const manager = deps.getOpenClawEngineManager();
      return {
        success: true,
        status: manager.getStatus(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get OpenClaw engine status',
      };
    }
  });

  ipcMain.handle('openclaw:engine:install', async () => {
    try {
      deps.bindExternalAgentCliInstallerForwarder();
      const installResult = await deps.getExternalAgentCliInstaller().install('openclaw');
      if (!installResult.success) {
        return {
          success: false,
          status: deps.getOpenClawEngineManager().getStatus(),
          error: installResult.error || 'Failed to install OpenClaw CLI',
        };
      }
      const status = await deps.getOpenClawEngineManager().ensureReady();
      return {
        success: status.phase === 'running' || status.phase === 'ready',
        status,
      };
    } catch (error) {
      const manager = deps.getOpenClawEngineManager();
      return {
        success: false,
        status: manager.getStatus(),
        error: error instanceof Error ? error.message : 'Failed to install OpenClaw engine',
      };
    }
  });

  ipcMain.handle('openclaw:engine:retryInstall', async () => {
    try {
      deps.bindExternalAgentCliInstallerForwarder();
      const installResult = await deps.getExternalAgentCliInstaller().install('openclaw');
      if (!installResult.success) {
        return {
          success: false,
          status: deps.getOpenClawEngineManager().getStatus(),
          error: installResult.error || 'Failed to install OpenClaw CLI',
        };
      }
      const status = await deps.getOpenClawEngineManager().ensureReady();
      return {
        success: status.phase === 'running' || status.phase === 'ready',
        status,
      };
    } catch (error) {
      const manager = deps.getOpenClawEngineManager();
      return {
        success: false,
        status: manager.getStatus(),
        error: error instanceof Error ? error.message : 'Failed to retry OpenClaw engine install',
      };
    }
  });

  ipcMain.handle('openclaw:engine:restartGateway', async () => {
    if (restartGatewayPromise) {
      const status = await restartGatewayPromise;
      return { success: status.phase === 'running' || status.phase === 'ready', status };
    }
    try {
      const manager = deps.getOpenClawEngineManager();
      restartGatewayPromise = manager.restartGateway();
      const status = await restartGatewayPromise;
      return {
        success: status.phase === 'running' || status.phase === 'ready',
        status,
      };
    } catch (error) {
      const manager = deps.getOpenClawEngineManager();
      return {
        success: false,
        status: manager.getStatus(),
        error: error instanceof Error ? error.message : 'Failed to restart OpenClaw gateway',
      };
    } finally {
      restartGatewayPromise = null;
    }
  });

  // ── Hermes Agent Engine ──────────────────────────────────────────────

  ipcMain.handle('hermes:engine:getStatus', async () => {
    try {
      const manager = deps.getHermesEngineManager();
      return {
        success: true,
        status: manager.getStatus(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Hermes Agent engine status',
      };
    }
  });

  ipcMain.handle('hermes:engine:install', async () => {
    try {
      deps.bindExternalAgentCliInstallerForwarder();
      const installResult = await deps.getExternalAgentCliInstaller().install('hermes');
      if (!installResult.success) {
        return {
          success: false,
          status: deps.getHermesEngineManager().getStatus(),
          error: installResult.error || 'Failed to install Hermes Agent CLI',
        };
      }
      deps.getCoworkStore().setConfig({ hermesConfigSource: ExternalAgentConfigSource.AgoraModel });
      const status = await deps.bootstrapHermesEngine({
        forceReinstall: false,
        reason: 'manual-install',
      });
      return {
        success: status.phase === 'running' || status.phase === 'ready',
        status,
      };
    } catch (error) {
      const manager = deps.getHermesEngineManager();
      return {
        success: false,
        status: manager.getStatus(),
        error: error instanceof Error ? error.message : 'Failed to install Hermes Agent engine',
      };
    }
  });

  ipcMain.handle('hermes:engine:retryInstall', async () => {
    try {
      deps.bindExternalAgentCliInstallerForwarder();
      const installResult = await deps.getExternalAgentCliInstaller().install('hermes');
      if (!installResult.success) {
        return {
          success: false,
          status: deps.getHermesEngineManager().getStatus(),
          error: installResult.error || 'Failed to install Hermes Agent CLI',
        };
      }
      deps.getCoworkStore().setConfig({ hermesConfigSource: ExternalAgentConfigSource.AgoraModel });
      const status = await deps.bootstrapHermesEngine({
        forceReinstall: true,
        reason: 'manual-retry',
      });
      return {
        success: status.phase === 'running' || status.phase === 'ready',
        status,
      };
    } catch (error) {
      const manager = deps.getHermesEngineManager();
      return {
        success: false,
        status: manager.getStatus(),
        error: error instanceof Error ? error.message : 'Failed to retry Hermes Agent engine install',
      };
    }
  });

  ipcMain.handle('hermes:engine:restartGateway', async () => {
    if (restartHermesGatewayPromise) {
      const status = await restartHermesGatewayPromise;
      return { success: status.phase === 'running' || status.phase === 'ready', status };
    }
    try {
      const syncResult = deps.getHermesConfigSync().sync('manual-restart');
      if (!syncResult.success) {
        return {
          success: false,
          status: syncResult.status || deps.getHermesEngineManager().getStatus(),
          error: syncResult.error || 'Hermes Agent config sync failed',
        };
      }
      const manager = deps.getHermesEngineManager();
      restartHermesGatewayPromise = manager.restartGateway();
      const status = await restartHermesGatewayPromise;
      return {
        success: status.phase === 'running' || status.phase === 'ready',
        status,
      };
    } catch (error) {
      const manager = deps.getHermesEngineManager();
      return {
        success: false,
        status: manager.getStatus(),
        error: error instanceof Error ? error.message : 'Failed to restart Hermes Agent gateway',
      };
    } finally {
      restartHermesGatewayPromise = null;
    }
  });
}
