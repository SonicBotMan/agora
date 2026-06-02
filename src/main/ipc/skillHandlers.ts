/**
 * Agora — Skill IPC Handlers
 * Skill lifecycle: scan, install, enable/disable, execute, marketplace.
 */

import { ipcMain } from 'electron';

export interface SkillInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  source: 'bundled' | 'marketplace' | 'local';
  installedAt: string;
  error?: string;
}

export interface SkillDeps {
  scanSkills: () => Promise<SkillInfo[]>;
  getSkill: (id: string) => Promise<SkillInfo | null>;
  installSkill: (source: string, options?: Record<string, unknown>) => Promise<SkillInfo>;
  uninstallSkill: (id: string) => Promise<void>;
  enableSkill: (id: string) => Promise<void>;
  disableSkill: (id: string) => Promise<void>;
  executeSkill: (id: string, args: Record<string, unknown>) => Promise<unknown>;
  getSkillLog: (id: string, lines?: number) => Promise<string[]>;
  searchMarketplace: (query: string) => Promise<unknown[]>;
  importSkill: (path: string) => Promise<SkillInfo>;
  exportSkill: (id: string, targetPath: string) => Promise<string>;
  validateSkill: (path: string) => Promise<{ valid: boolean; errors?: string[] }>;
  getSkillConfig: (id: string) => Promise<Record<string, unknown>>;
  setSkillConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
}

export function registerSkillHandlers(deps: SkillDeps): void {
  ipcMain.handle('skill:scan', async () => deps.scanSkills());
  ipcMain.handle('skill:get', async (_event, id: string) => deps.getSkill(id));
  ipcMain.handle('skill:install', async (_event, source: string, options?: Record<string, unknown>) => {
    return deps.installSkill(source, options);
  });
  ipcMain.handle('skill:uninstall', async (_event, id: string) => deps.uninstallSkill(id));
  ipcMain.handle('skill:enable', async (_event, id: string) => deps.enableSkill(id));
  ipcMain.handle('skill:disable', async (_event, id: string) => deps.disableSkill(id));
  ipcMain.handle('skill:execute', async (_event, id: string, args: Record<string, unknown>) => {
    return deps.executeSkill(id, args);
  });
  ipcMain.handle('skill:getLog', async (_event, id: string, lines?: number) => {
    return deps.getSkillLog(id, lines);
  });
  ipcMain.handle('skill:searchMarketplace', async (_event, query: string) => {
    return deps.searchMarketplace(query);
  });
  ipcMain.handle('skill:import', async (_event, path: string) => deps.importSkill(path));
  ipcMain.handle('skill:export', async (_event, id: string, targetPath: string) => {
    return deps.exportSkill(id, targetPath);
  });
  ipcMain.handle('skill:validate', async (_event, path: string) => deps.validateSkill(path));
  ipcMain.handle('skill:getConfig', async (_event, id: string) => deps.getSkillConfig(id));
  ipcMain.handle('skill:setConfig', async (_event, id: string, config: Record<string, unknown>) => {
    await deps.setSkillConfig(id, config);
  });
}
