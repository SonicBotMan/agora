import type { IpcMain } from 'electron';

/**
 * Type for an IPC handler registration function.
 * Each domain-specific handler module exports a function matching this signature.
 */
export type IpcHandlerRegistration = (ipcMain: IpcMain) => void;
