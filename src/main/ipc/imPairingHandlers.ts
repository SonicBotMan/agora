import { ipcMain } from 'electron';

import type { ImDeps } from './imDeps';

export type ImPairingDeps = Pick<
  ImDeps,
  | 'getOpenClawEngineManager'
  | 'syncOpenClawConfig'
  | 'listPairingRequests'
  | 'readAllowFromStore'
  | 'approvePairingCode'
  | 'rejectPairingRequest'
>;

export function registerImPairingHandlers(deps: ImPairingDeps): void {
  ipcMain.handle('im:pairing:list', async (_event, platform: string) => {
    try {
      const stateDir = deps.getOpenClawEngineManager().getStateDir();
      const requests = deps.listPairingRequests(platform, stateDir);
      const allowFrom = deps.readAllowFromStore(platform, stateDir);
      return { success: true, requests, allowFrom };
    } catch (error) {
      return {
        success: false,
        requests: [],
        allowFrom: [],
        error: error instanceof Error ? error.message : 'Failed to list pairing requests',
      };
    }
  });

  ipcMain.handle('im:pairing:approve', async (_event, platform: string, code: string) => {
    try {
      const stateDir = deps.getOpenClawEngineManager().getStateDir();
      const approved = deps.approvePairingCode(platform, code, stateDir);
      if (!approved) {
        return { success: false, error: 'Pairing code not found or expired' };
      }
      await deps.syncOpenClawConfig({
        reason: `im-pairing-approval:${platform}`,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve pairing code',
      };
    }
  });

  ipcMain.handle('im:pairing:reject', async (_event, platform: string, code: string) => {
    try {
      const stateDir = deps.getOpenClawEngineManager().getStateDir();
      const rejected = deps.rejectPairingRequest(platform, code, stateDir);
      if (!rejected) {
        return { success: false, error: 'Pairing code not found or expired' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject pairing request',
      };
    }
  });
}
