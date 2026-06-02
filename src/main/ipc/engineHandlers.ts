/**
 * Agora — Engine IPC Handlers
 * Per-engine adapter management: OpenClaw, ClaudeCode, Hermes, OpenCode, DeepSeekTUI, Codex.
 */

import { ipcMain } from 'electron';

export interface EngineStatus {
  id: string;
  name: string;
  available: boolean;
  version?: string;
  pid?: number;
  uptime?: number;
  error?: string;
}

export interface EngineDeps {
  getEngineStatus: (engineId: string) => Promise<EngineStatus>;
  getAllEngineStatuses: () => Promise<EngineStatus[]>;
  startEngine: (engineId: string, options?: Record<string, unknown>) => Promise<void>;
  stopEngine: (engineId: string) => Promise<void>;
  restartEngine: (engineId: string) => Promise<void>;
  sendToEngine: (engineId: string, method: string, params: Record<string, unknown>) => Promise<unknown>;
  getEngineLogs: (engineId: string, lines?: number) => Promise<string[]>;
  getEngineConfig: (engineId: string) => Promise<Record<string, unknown>>;
  setEngineConfig: (engineId: string, config: Record<string, unknown>) => Promise<void>;
  installEngine: (engineId: string) => Promise<void>;
  uninstallEngine: (engineId: string) => Promise<void>;
  checkEngineUpdate: (engineId: string) => Promise<{ available: boolean; version?: string }>;
}

export function registerEngineHandlers(deps: EngineDeps): void {
  ipcMain.handle('engine:getStatus', async (_event, engineId: string) => deps.getEngineStatus(engineId));
  ipcMain.handle('engine:getAllStatuses', async () => deps.getAllEngineStatuses());
  ipcMain.handle('engine:start', async (_event, engineId: string, options?: Record<string, unknown>) => {
    await deps.startEngine(engineId, options);
  });
  ipcMain.handle('engine:stop', async (_event, engineId: string) => deps.stopEngine(engineId));
  ipcMain.handle('engine:restart', async (_event, engineId: string) => deps.restartEngine(engineId));
  ipcMain.handle('engine:send', async (_event, engineId: string, method: string, params: Record<string, unknown>) => {
    return deps.sendToEngine(engineId, method, params);
  });
  ipcMain.handle('engine:getLogs', async (_event, engineId: string, lines?: number) => {
    return deps.getEngineLogs(engineId, lines);
  });
  ipcMain.handle('engine:getConfig', async (_event, engineId: string) => deps.getEngineConfig(engineId));
  ipcMain.handle('engine:setConfig', async (_event, engineId: string, config: Record<string, unknown>) => {
    await deps.setEngineConfig(engineId, config);
  });
  ipcMain.handle('engine:install', async (_event, engineId: string) => deps.installEngine(engineId));
  ipcMain.handle('engine:uninstall', async (_event, engineId: string) => deps.uninstallEngine(engineId));
  ipcMain.handle('engine:checkUpdate', async (_event, engineId: string) => deps.checkEngineUpdate(engineId));
}
