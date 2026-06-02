/**
 * IPC handlers barrel export.
 * Aggregates all domain-specific handler registrations.
 */

import type { IpcMain } from 'electron';
import { registerSessionHandlers } from './sessionHandlers';
import { registerEngineHandlers } from './engineHandlers';
import { registerImHandlers } from './imHandlers';
import { registerSkillHandlers } from './skillHandlers';
import { registerPermissionHandlers } from './permissionHandlers';
import { registerAttachmentHandlers } from './attachmentHandlers';

/**
 * Register all domain IPC handlers on the given IpcMain instance.
 * Call this during Electron main process initialization.
 */
export function registerAllIpcHandlers(ipcMain: IpcMain): void {
  registerSessionHandlers(ipcMain);
  registerEngineHandlers(ipcMain);
  registerImHandlers(ipcMain);
  registerSkillHandlers(ipcMain);
  registerPermissionHandlers(ipcMain);
  registerAttachmentHandlers(ipcMain);
}

export { registerSessionHandlers } from './sessionHandlers';
export { registerEngineHandlers } from './engineHandlers';
export { registerImHandlers } from './imHandlers';
export { registerSkillHandlers } from './skillHandlers';
export { registerPermissionHandlers } from './permissionHandlers';
export { registerAttachmentHandlers } from './attachmentHandlers';
export type { IpcHandlerRegistration } from './types';
