/**
 * Agora — Skill IPC Handlers
 *
 * Extracted from main.ts (lines ~3147–3238).
 * Skill lifecycle: list, enable/disable, delete, download, upgrade,
 * confirm install, config, email connectivity, and marketplace.
 */

import { ipcMain } from 'electron';

import { SkillsIpcChannel } from '../../shared/skills/constants';
import { SkillManager } from '../skillManager';

export interface SkillDeps {
  getSkillManager: () => SkillManager;
}

export function registerSkillHandlers(deps: SkillDeps): void {
  // ── skills:list ─────────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.List, () => {
    try {
      const skills = deps.getSkillManager().listSkills();
      return { success: true, skills };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load skills' };
    }
  });

  // ── skills:setEnabled ────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.SetEnabled, (_event, options: { id: string; enabled: boolean }) => {
    try {
      const skills = deps.getSkillManager().setSkillEnabled(options.id, options.enabled);
      return { success: true, skills };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update skill' };
    }
  });

  // ── skills:delete ───────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.Delete, (_event, id: string) => {
    try {
      const skills = deps.getSkillManager().deleteSkill(id);
      return { success: true, skills };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete skill' };
    }
  });

  // ── skills:download ─────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.Download, async (_event, source: string) => {
    return deps.getSkillManager().downloadSkill(source);
  });

  // ── skills:upgrade ──────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.Upgrade, async (_event, skillId: string, downloadUrl: string) => {
    return deps.getSkillManager().upgradeSkill(skillId, downloadUrl);
  });

  // ── skills:confirmInstall ───────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.ConfirmInstall, async (_event, pendingId: string, action: string) => {
    const validActions = ['install', 'installDisabled', 'cancel'];
    if (!validActions.includes(action)) {
      return { success: false, error: 'Invalid action' };
    }
    return deps.getSkillManager().confirmPendingInstall(
      pendingId,
      action as 'install' | 'installDisabled' | 'cancel',
    );
  });

  // ── skills:getRoot ──────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.GetRoot, () => {
    try {
      const root = deps.getSkillManager().getSkillsRoot();
      return { success: true, path: root };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to resolve skills root' };
    }
  });

  // ── skills:autoRoutingPrompt ────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.AutoRoutingPrompt, () => {
    try {
      const prompt = deps.getSkillManager().buildAutoRoutingPrompt();
      return { success: true, prompt };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to build auto-routing prompt' };
    }
  });

  // ── skills:getConfig ────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.GetConfig, (_event, skillId: string) => {
    return deps.getSkillManager().getSkillConfig(skillId);
  });

  // ── skills:setConfig ────────────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.SetConfig, (_event, skillId: string, config: Record<string, string>) => {
    return deps.getSkillManager().setSkillConfig(skillId, config);
  });

  // ── skills:testEmailConnectivity ────────────────────────────────────────
  ipcMain.handle(
    SkillsIpcChannel.TestEmailConnectivity,
    async (_event, skillId: string, config: Record<string, string>) => {
      return deps.getSkillManager().testEmailConnectivity(skillId, config);
    },
  );

  // ── skills:fetchMarketplace ─────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.FetchMarketplace, async (_event, options) => {
    return deps.getSkillManager().fetchMarketplaceSkills(options ?? {});
  });

  // ── skills:searchMarketplace ────────────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.SearchMarketplace, async (_event, options) => {
    return deps.getSkillManager().searchMarketplaceSkills(options ?? {});
  });

  // ── skills:installMarketplaceSkill ──────────────────────────────────────
  ipcMain.handle(SkillsIpcChannel.InstallMarketplaceSkill, async (_event, skill) => {
    return deps.getSkillManager().installMarketplaceSkill(skill);
  });
}
