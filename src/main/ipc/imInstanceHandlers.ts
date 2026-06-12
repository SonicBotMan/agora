import crypto from 'crypto';
import { ipcMain } from 'electron';

import { type ImConfigSyncDeps, scheduleImConfigSync, shouldSyncRunningIMGatewayConfig } from './imConfigSync';
import type { ImDeps } from './imDeps';

export type ImInstanceDeps = Pick<
  ImDeps,
  | 'getIMGatewayManager'
> & ImConfigSyncDeps;

export function registerImInstanceHandlers(deps: ImInstanceDeps): void {
  ipcMain.handle('im:dingtalk:instance:add', async (_event, name: string) => {
    try {
      const instanceId = crypto.randomUUID();
      const { DEFAULT_DINGTALK_OPENCLAW_CONFIG: defaults } = await import('../im/types');
      const instance = {
        ...defaults,
        instanceId,
        instanceName: name || 'DingTalk Bot',
      };
      deps.getIMGatewayManager().getIMStore().setDingTalkInstanceConfig(instanceId, instance);
      return { success: true, instance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add DingTalk instance',
      };
    }
  });

  ipcMain.handle('im:dingtalk:instance:delete', async (_event, instanceId: string) => {
    try {
      deps.getIMGatewayManager().getIMStore().deleteDingTalkInstance(instanceId);
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete DingTalk instance',
      };
    }
  });

  ipcMain.handle('im:dingtalk:instance:config:set', async (_event, instanceId: string, config: any, options?: { syncGateway?: boolean }) => {
    try {
      deps.getIMGatewayManager().getIMStore().setDingTalkInstanceConfig(instanceId, config);
      if (options?.syncGateway && shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set DingTalk instance config',
      };
    }
  });

  ipcMain.handle('im:qq:instance:add', async (_event, name: string) => {
    try {
      const instanceId = crypto.randomUUID();
      const { DEFAULT_QQ_CONFIG: defaults } = await import('../im/types');
      const instance = {
        ...defaults,
        instanceId,
        instanceName: name || 'QQ Bot',
      };
      deps.getIMGatewayManager().getIMStore().setQQInstanceConfig(instanceId, instance);
      return { success: true, instance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add QQ instance',
      };
    }
  });

  ipcMain.handle('im:qq:instance:delete', async (_event, instanceId: string) => {
    try {
      deps.getIMGatewayManager().getIMStore().deleteQQInstance(instanceId);
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete QQ instance',
      };
    }
  });

  ipcMain.handle('im:qq:instance:config:set', async (_event, instanceId: string, config: any, options?: { syncGateway?: boolean }) => {
    try {
      deps.getIMGatewayManager().getIMStore().setQQInstanceConfig(instanceId, config);
      if (options?.syncGateway && shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set QQ instance config',
      };
    }
  });
}
