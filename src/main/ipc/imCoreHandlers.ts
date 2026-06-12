import { ipcMain } from 'electron';
import os from 'os';

import type { Platform } from '../im/types';
import { type ImConfigSyncDeps,scheduleImConfigSync, shouldSyncRunningIMGatewayConfig } from './imConfigSync';
import type { ImDeps } from './imDeps';

export type ImCoreDeps = Pick<
  ImDeps,
  | 'getIMGatewayManager'
  | 'getOpenClawEngineManager'
> & ImConfigSyncDeps;

export function registerImCoreHandlers(deps: ImCoreDeps): void {
  ipcMain.handle('im:config:get', async () => {
    try {
      const config = deps.getIMGatewayManager().getConfig();
      return { success: true, config };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get IM config',
      };
    }
  });

  ipcMain.handle('im:config:set', async (_event, config: Partial<any>, options?: { syncGateway?: boolean }) => {
    try {
      deps.getIMGatewayManager().setConfig(config, { syncGateway: options?.syncGateway });

      const hasOpenClawChange = (config as any).telegram || (config as any).discord || (config as any).dingtalk
        || (config as any).feishu || (config as any).qq || (config as any).wecom || (config as any).popo || (config as any).weixin;
      if (options?.syncGateway && hasOpenClawChange && shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set IM config',
      };
    }
  });

  ipcMain.handle('im:config:sync', async () => {
    try {
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync IM config',
      };
    }
  });

  ipcMain.handle('im:gateway:start', async (_event, platform: Platform) => {
    try {
      const manager = deps.getIMGatewayManager();
      manager.setConfig({ [platform]: { enabled: true } } as any);
      await manager.startGateway(platform);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start gateway',
      };
    }
  });

  ipcMain.handle('im:gateway:stop', async (_event, platform: Platform) => {
    try {
      const manager = deps.getIMGatewayManager();
      manager.setConfig({ [platform]: { enabled: false } } as any);
      await manager.stopGateway(platform);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop gateway',
      };
    }
  });

  ipcMain.handle('im:gateway:test', async (
    _event,
    platform: Platform,
    configOverride?: Partial<any>,
  ) => {
    try {
      const result = await deps.getIMGatewayManager().testGateway(platform, configOverride);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test gateway connectivity',
      };
    }
  });

  ipcMain.handle('im:weixin:qr-login-start', async () => {
    try {
      const result = await deps.getIMGatewayManager().weixinQrLoginStart();
      return { success: true, ...result };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Failed to start Weixin QR login' };
    }
  });

  ipcMain.handle('im:weixin:qr-login-wait', async (_event, accountId?: string) => {
    try {
      const result = await deps.getIMGatewayManager().weixinQrLoginWait(accountId);
      if (result.connected) {
        console.log('[IMGatewayManager] Weixin login succeeded, restarting OpenClaw gateway');
        await deps.getOpenClawEngineManager().restartGateway();
      }
      return { success: true, ...result };
    } catch (error) {
      return { success: false, connected: false, message: error instanceof Error ? error.message : 'Weixin QR login failed' };
    }
  });

  ipcMain.handle('im:status:get', async () => {
    try {
      const status = deps.getIMGatewayManager().getStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get IM status',
      };
    }
  });

  ipcMain.handle('im:getLocalIp', () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  });

  ipcMain.handle('im:openclaw:config-schema', async () => {
    try {
      const result = await deps.getIMGatewayManager().getOpenClawConfigSchema();
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get OpenClaw config schema',
      };
    }
  });
}
