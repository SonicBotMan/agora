/**
 * Agora — Permission IPC Handlers
 * Agent permission control: grant, revoke, query, reset.
 */

import { ipcMain } from 'electron';

export interface PermissionDeps {
  grantPermission: (sessionId: string, permission: string, scope?: string) => Promise<void>;
  revokePermission: (sessionId: string, permission: string) => Promise<void>;
  getPermissions: (sessionId: string) => Promise<string[]>;
  resetPermissions: (sessionId: string) => Promise<void>;
  getAllSessionPermissions: () => Promise<Record<string, string[]>>;
}

export function registerPermissionHandlers(deps: PermissionDeps): void {
  ipcMain.handle('permission:grant', async (_event, sessionId: string, permission: string, scope?: string) => {
    await deps.grantPermission(sessionId, permission, scope);
  });

  ipcMain.handle('permission:revoke', async (_event, sessionId: string, permission: string) => {
    await deps.revokePermission(sessionId, permission);
  });

  ipcMain.handle('permission:get', async (_event, sessionId: string) => {
    return deps.getPermissions(sessionId);
  });

  ipcMain.handle('permission:reset', async (_event, sessionId: string) => {
    await deps.resetPermissions(sessionId);
  });

  ipcMain.handle('permission:getAll', async () => {
    return deps.getAllSessionPermissions();
  });
}
