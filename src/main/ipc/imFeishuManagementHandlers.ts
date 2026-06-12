import crypto from 'crypto';
import { ipcMain } from 'electron';

import {
  FeishuEngineKey,
  FeishuImportSource,
  FeishuManagementMode,
  FeishuRuntimeOwnership,
  ImIpcChannel,
  isFeishuEngineKey,
  isFeishuManagementMode,
  isFeishuRuntimeOwnership,
} from '../../shared/im/constants';
import type { Platform } from '../im/types';
import {
  type ImConfigSyncDeps,
  scheduleImConfigSync,
  shouldSyncRunningIMGatewayConfig,
} from './imConfigSync';
import type { ImDeps } from './imDeps';

export type ImFeishuManagementDeps = Pick<
  ImDeps,
  | 'getIMGatewayManager'
  | 'getOpenClawEngineManager'
  | 'getHermesEngineManager'
  | 'normalizeFeishuEngineKey'
  | 'getFeishuRuntimeOwnership'
  | 'getFeishuRuntimeOwnershipStatus'
  | 'transferFeishuToLocalRuntime'
  | 'transferFeishuToAgoraRuntime'
  | 'detectLocalOpenClawFeishu'
  | 'importOpenClawLocalFeishuConfig'
> & ImConfigSyncDeps;

export function registerImFeishuManagementHandlers(
  deps: ImFeishuManagementDeps,
): void {
  ipcMain.handle(ImIpcChannel.FeishuDetectOpenClawLocal, async () => {
    try {
      return {
        success: true,
        result: deps.detectLocalOpenClawFeishu(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to detect local OpenClaw Feishu config',
      };
    }
  });

  ipcMain.handle(ImIpcChannel.FeishuImportOpenClawLocal, async () => {
    try {
      const candidate = deps.importOpenClawLocalFeishuConfig();
      if (!candidate.canImport) {
        return {
          success: false,
          error:
            candidate.message
            || 'No importable local OpenClaw Feishu config was found.',
        };
      }
      const instanceId = crypto.randomUUID();
      const instance = {
        ...candidate.instanceConfig,
        instanceId,
        instanceName: 'OpenClaw Feishu Bot',
        enabled: false,
        importSource: FeishuImportSource.OpenClawLocal,
      };
      deps
        .getIMGatewayManager()
        .getIMStore()
        .setFeishuInstanceConfigForEngine(FeishuEngineKey.OpenClaw, instanceId, {
          ...instance,
          engineKey: FeishuEngineKey.OpenClaw,
        });
      deps
        .getIMGatewayManager()
        .getIMStore()
        .setFeishuManagementMode(FeishuManagementMode.LocalOpenClaw);
      return {
        success: true,
        instance,
        result: deps.detectLocalOpenClawFeishu(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to import local OpenClaw Feishu config',
      };
    }
  });

  ipcMain.handle(ImIpcChannel.FeishuSetManagementMode, async (_event, mode: unknown) => {
    try {
      if (!isFeishuManagementMode(mode)) {
        return {
          success: false,
          error: 'Invalid Feishu management mode.',
        };
      }
      deps.getIMGatewayManager().getIMStore().setFeishuManagementMode(mode);
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      if (mode === FeishuManagementMode.LocalOpenClaw) {
        await deps
          .getIMGatewayManager()
          .stopGateway('feishu' as Platform)
          .catch((error) => {
            console.warn(
              '[IM] Failed to stop native Feishu gateway after management mode switch:',
              error,
            );
          });
      } else {
        await deps.getIMGatewayManager().startAllEnabled().catch((error) => {
          console.warn(
            '[IM] Failed to restart Feishu gateway after management mode switch:',
            error,
          );
        });
      }
      return {
        success: true,
        mode,
        status: deps.getIMGatewayManager().getStatus().feishu?.openClawLocal,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update Feishu management mode',
      };
    }
  });

  ipcMain.handle(ImIpcChannel.FeishuSetRuntimeOwnership, async (_event, input: unknown) => {
    try {
      const record =
        input && typeof input === 'object' && !Array.isArray(input)
          ? (input as { engineKey?: unknown; ownership?: unknown })
          : {};
      if (!isFeishuEngineKey(record.engineKey)) {
        return {
          success: false,
          error: 'Invalid Feishu engine ownership target.',
        };
      }
      if (
        record.engineKey !== FeishuEngineKey.OpenClaw
        && record.engineKey !== FeishuEngineKey.Hermes
      ) {
        return {
          success: false,
          error: 'Only OpenClaw and Hermes Agent support local runtime ownership.',
        };
      }
      if (!isFeishuRuntimeOwnership(record.ownership)) {
        return {
          success: false,
          error: 'Invalid Feishu runtime ownership mode.',
        };
      }

      const manager = deps.getIMGatewayManager();
      const engineKey = record.engineKey as string;
      const ownership = record.ownership as string;
      const transferResult =
        ownership === FeishuRuntimeOwnership.LocalRuntime
          ? await deps.transferFeishuToLocalRuntime(
            engineKey,
            manager.getIMStore().getFeishuInstances(engineKey),
            {
              openClawEngineManager: deps.getOpenClawEngineManager(),
              hermesEngineManager: deps.getHermesEngineManager(),
            },
          )
          : await deps.transferFeishuToAgoraRuntime(engineKey);

      if (!transferResult.success) {
        return transferResult;
      }

      manager.getIMStore().setFeishuRuntimeOwnership(engineKey, ownership);
      if (ownership === FeishuRuntimeOwnership.LocalRuntime) {
        await manager.stopGateway('feishu' as Platform).catch((error) => {
          console.warn(
            '[IM] Failed to stop Agora Feishu gateway after local runtime ownership switch:',
            error,
          );
        });
      } else {
        if (shouldSyncRunningIMGatewayConfig(deps)) {
          scheduleImConfigSync(deps);
        }
        await manager.startAllEnabled().catch((error) => {
          console.warn(
            '[IM] Failed to restart Feishu gateway after Agora ownership switch:',
            error,
          );
        });
      }

      return {
        success: true,
        ownership,
        status:
          transferResult.status
          ?? deps.getFeishuRuntimeOwnershipStatus(engineKey, ownership),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update Feishu runtime ownership.',
      };
    }
  });

  ipcMain.handle(
    ImIpcChannel.FeishuRefreshRuntimeOwnership,
    async (_event, engineKeyInput: unknown) => {
      try {
        const engineKey = deps.normalizeFeishuEngineKey(engineKeyInput);
        const ownership = deps.getFeishuRuntimeOwnership(engineKey);
        return {
          success: true,
          ownership,
          status: deps.getFeishuRuntimeOwnershipStatus(engineKey, ownership),
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to refresh Feishu runtime ownership status.',
        };
      }
    },
  );
}
