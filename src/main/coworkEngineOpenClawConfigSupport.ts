import { ExternalAgentConfigSource } from '../shared/cowork/constants';
import {
  type OpenClawConfigSupport,
  type OpenClawConfigSupportDeps,
  type SyncOpenClawConfigResult,
} from './coworkEngineOpenClawConfigContract';
import { createOpenClawConfigSyncGetter } from './coworkEngineOpenClawConfigSyncBuilderSupport';
import { createOpenClawConfigFeishuSupport } from './coworkEngineOpenClawFeishuSupport';
import { mergeEnterpriseOpenclawConfig } from './libs/enterpriseConfigSync';
export type {
  CronJobServiceLike,
  OpenClawConfigSupport,
  OpenClawConfigSupportDeps,
  SyncOpenClawConfigResult,
} from './coworkEngineOpenClawConfigContract';

const DEFERRED_RESTART_POLL_MS = 3_000;
const DEFERRED_RESTART_MAX_WAIT_MS = 5 * 60_000;

type DeferredGatewayRestartRequest = {
  reason: string;
  restartGatewayIfRunning: boolean;
  force: boolean;
};

export function createOpenClawConfigSupport(
  deps: OpenClawConfigSupportDeps,
): OpenClawConfigSupport {
  let deferredRestartTimer: ReturnType<typeof setInterval> | null = null;
  let deferredRestartTimeout: ReturnType<typeof setTimeout> | null = null;
  let deferredRestartRequest: DeferredGatewayRestartRequest | null = null;

  const feishuSupport = createOpenClawConfigFeishuSupport(deps);
  const getOpenClawConfigSync = createOpenClawConfigSyncGetter(deps, {
    shouldWriteOpenClawFeishuChannel:
      feishuSupport.shouldWriteOpenClawFeishuChannel,
    isFeishuManagedByOpenClawConfig:
      feishuSupport.isFeishuManagedByOpenClawConfig,
  });

  const hasActiveGatewayWorkloads = (): boolean => {
    if (deps.getOpenClawRuntimeAdapter()?.hasActiveSessions()) {
      return true;
    }
    try {
      if (deps.getCronJobService().hasRunningJobs()) {
        return true;
      }
    } catch {
      // CronJobService may not be initialized yet.
    }
    return false;
  };

  const clearDeferredRestart = (): void => {
    if (deferredRestartTimer) {
      clearInterval(deferredRestartTimer);
      deferredRestartTimer = null;
    }
    if (deferredRestartTimeout) {
      clearTimeout(deferredRestartTimeout);
      deferredRestartTimeout = null;
    }
    deferredRestartRequest = null;
  };

  const executeDeferredGatewayRestart = async (
    request: DeferredGatewayRestartRequest,
  ): Promise<void> => {
    clearDeferredRestart();
    console.log(
      `[OpenClaw] executeDeferredGatewayRestart: performing deferred restart (reason: ${request.reason}, force=${request.force ? '1' : '0'})`,
    );
    await syncOpenClawConfig({
      reason: `deferred:${request.reason}`,
      restartGatewayIfRunning: request.restartGatewayIfRunning,
      ignoreActiveWorkloads: request.force,
    });
  };

  const scheduleDeferredGatewayRestart = (
    reason: string,
    restartGatewayIfRunning = false,
  ): void => {
    if (deferredRestartTimer) {
      deferredRestartRequest = {
        reason,
        restartGatewayIfRunning:
          Boolean(deferredRestartRequest?.restartGatewayIfRunning)
          || restartGatewayIfRunning,
        force: Boolean(deferredRestartRequest?.force),
      };
      console.log(
        `[OpenClaw] scheduleDeferredGatewayRestart: already scheduled, skipping (reason: ${reason})`,
      );
      return;
    }

    deferredRestartRequest = {
      reason,
      restartGatewayIfRunning,
      force: false,
    };

    deferredRestartTimer = setInterval(() => {
      if (!hasActiveGatewayWorkloads() && deferredRestartRequest) {
        void executeDeferredGatewayRestart(deferredRestartRequest);
      }
    }, DEFERRED_RESTART_POLL_MS);

    deferredRestartTimeout = setTimeout(() => {
      console.warn(
        `[OpenClaw] scheduleDeferredGatewayRestart: max wait exceeded, forcing restart (reason: ${reason})`,
      );
      if (!deferredRestartRequest) {
        return;
      }
      void executeDeferredGatewayRestart({
        ...deferredRestartRequest,
        force: true,
      });
    }, DEFERRED_RESTART_MAX_WAIT_MS);
  };

  const syncOpenClawConfig = async (
    options: {
      reason: string;
      restartGatewayIfRunning?: boolean;
      ignoreActiveWorkloads?: boolean;
    } = { reason: 'unknown' },
  ): Promise<SyncOpenClawConfigResult> => {
    if (process.env.AGORA_OPENCLAW_VERBOSE_LOGS === '1') {
      console.debug(
        `[OpenClaw] syncing config for ${options.reason}; gateway restart ${options.restartGatewayIfRunning ? 'enabled' : 'skipped'}`,
      );
    }

    const syncResult = getOpenClawConfigSync().sync(options.reason);
    if (!syncResult.ok) {
      const status = deps.getOpenClawEngineManager().setExternalError(
        `OpenClaw config sync failed: ${syncResult.error || 'unknown error'}`,
      );
      return {
        success: false,
        changed: false,
        status,
        error: syncResult.error,
      };
    }

    const manager = deps.getOpenClawEngineManager();
    const nextSecretEnvVars = getOpenClawConfigSync().collectSecretEnvVars();
    const prevSecretEnvVars = manager.getSecretEnvVars();
    const secretEnvVarsChanged =
      JSON.stringify(nextSecretEnvVars) !== JSON.stringify(prevSecretEnvVars);
    const shouldUseManagedGateway =
      deps.getCoworkStore().getConfig().openclawConfigSource
      === ExternalAgentConfigSource.AgoraModel;
    manager.setSecretEnvVars(nextSecretEnvVars);
    manager.setRequireManagedGateway(shouldUseManagedGateway);

    if (syncResult.skipped) {
      return {
        success: true,
        changed: false,
        status: manager.getStatus(),
      };
    }

    try {
      mergeEnterpriseOpenclawConfig(manager.getConfigPath());
    } catch {
      // non-critical
    }

    const status = manager.getStatus();
    const needsManagedModeRestart =
      shouldUseManagedGateway
      && status.phase === 'running'
      && status.gatewayMode !== 'managed';
    const needsHardRestart =
      secretEnvVarsChanged
      || needsManagedModeRestart
      || (syncResult.changed && options.restartGatewayIfRunning);

    if (!needsHardRestart) {
      return {
        success: true,
        changed: syncResult.changed,
      };
    }

    if (status.phase !== 'running') {
      return {
        success: true,
        changed: true,
        status,
      };
    }

    if (!options.ignoreActiveWorkloads && hasActiveGatewayWorkloads()) {
      console.log(
        `[OpenClaw] syncOpenClawConfig: deferring hard restart because active workloads exist (reason: ${options.reason})`,
      );
      scheduleDeferredGatewayRestart(
        options.reason,
        Boolean(options.restartGatewayIfRunning),
      );
      return {
        success: true,
        changed: true,
        status,
      };
    }

    const runtimeAdapter = deps.getOpenClawRuntimeAdapter();
    if (runtimeAdapter) {
      console.log(
        `[OpenClaw] syncOpenClawConfig: pre-emptively disconnecting runtime adapter before gateway restart (reason: ${options.reason})`,
      );
      runtimeAdapter.disconnectGatewayClient();
    }

    await manager.stopGateway();
    const restarted = await manager.startGateway();
    if (restarted.phase !== 'running') {
      return {
        success: false,
        changed: true,
        status: restarted,
        error:
          restarted.message
          || 'Failed to restart OpenClaw gateway after config sync.',
      };
    }
    return {
      success: true,
      changed: true,
      status: restarted,
    };
  };

  return {
    getOpenClawConfigSync,
    syncOpenClawConfig,
    detectLocalOpenClawFeishu: feishuSupport.detectLocalOpenClawFeishu,
    hasLocalOpenClawFeishuConfigured:
      feishuSupport.hasLocalOpenClawFeishuConfigured,
  };
}
