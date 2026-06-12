import crypto from 'crypto';
import { ipcMain } from 'electron';

import {
  type ImConfigSyncDeps,
  scheduleImConfigSync,
  shouldSyncRunningIMGatewayConfig,
} from './imConfigSync';
import type { ImDeps } from './imDeps';

export type ImFeishuInstanceDeps = Pick<
  ImDeps,
  | 'getIMGatewayManager'
  | 'normalizeFeishuEngineKey'
> & ImConfigSyncDeps;

export function registerImFeishuInstanceHandlers(
  deps: ImFeishuInstanceDeps,
): void {
  ipcMain.handle('im:feishu:instance:add', async (_event, name: string, engineKeyValue?: unknown) => {
    try {
      const engineKey = deps.normalizeFeishuEngineKey(engineKeyValue);
      const instanceId = crypto.randomUUID();
      const { DEFAULT_FEISHU_OPENCLAW_CONFIG: defaults } = await import('../im/types');
      const instance = {
        ...defaults,
        instanceId,
        instanceName: name || 'Feishu Bot',
        engineKey,
      };
      deps
        .getIMGatewayManager()
        .getIMStore()
        .setFeishuInstanceConfigForEngine(engineKey, instanceId, instance);
      return { success: true, instance };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to add Feishu instance',
      };
    }
  });

  ipcMain.handle(
    'im:feishu:instance:delete',
    async (_event, instanceId: string, engineKeyValue?: unknown) => {
      try {
        const engineKey = deps.normalizeFeishuEngineKey(engineKeyValue);
        deps
          .getIMGatewayManager()
          .getIMStore()
          .deleteFeishuInstanceForEngine(engineKey, instanceId);
        if (shouldSyncRunningIMGatewayConfig(deps)) {
          scheduleImConfigSync(deps);
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete Feishu instance',
        };
      }
    },
  );

  ipcMain.handle(
    'im:feishu:instance:config:set',
    async (
      _event,
      instanceId: string,
      config: any,
      options?: { syncGateway?: boolean; engineKey?: unknown },
    ) => {
      try {
        const engineKey = deps.normalizeFeishuEngineKey(
          options?.engineKey ?? config?.engineKey,
        );
        deps
          .getIMGatewayManager()
          .getIMStore()
          .setFeishuInstanceConfigForEngine(engineKey, instanceId, {
            ...config,
            engineKey,
          });
        if (options?.syncGateway && shouldSyncRunningIMGatewayConfig(deps)) {
          scheduleImConfigSync(deps);
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to set Feishu instance config',
        };
      }
    },
  );

  ipcMain.handle(
    'feishu:install:qrcode',
    async (_event, { isLark }: { isLark: boolean }) => {
      try {
        return await deps.getIMGatewayManager().startFeishuInstallQrcode(isLark);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : '获取二维码失败');
      }
    },
  );

  ipcMain.handle(
    'feishu:install:poll',
    async (_event, { deviceCode }: { deviceCode: string }) => {
      try {
        return await deps.getIMGatewayManager().pollFeishuInstall(deviceCode);
      } catch (error) {
        return {
          done: false,
          error: error instanceof Error ? error.message : '轮询失败',
        };
      }
    },
  );

  ipcMain.handle(
    'feishu:install:verify',
    async (_event, { appId, appSecret }: { appId: string; appSecret: string }) => {
      try {
        return await deps.getIMGatewayManager().verifyFeishuCredentials(
          appId,
          appSecret,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '验证失败',
        };
      }
    },
  );
}
