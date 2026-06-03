/**
 * Agora — Agent/AgentTeam IPC Handlers
 *
 * CRUD for user-defined agents and agent teams.
 * Extracted from main.ts lines 3937–4109.
 */

import { ipcMain } from 'electron';

import type { CreateAgentRequest, UpdateAgentRequest } from '../coworkStore';
import type { CreateAgentTeamRequest, UpdateAgentTeamRequest } from '../coworkStore';

export interface AgentsDeps {
  getAgentManager: () => {
    listAgents: () => unknown[];
    getAgent: (id: string) => unknown;
    createAgent: (request: CreateAgentRequest) => unknown;
    updateAgent: (id: string, updates: UpdateAgentRequest) => unknown;
    deleteAgent: (id: string) => boolean;
    getPresetAgents: () => unknown[];
    addPresetAgent: (presetId: string) => unknown;
    listAgentTeams: () => unknown[];
    getAgentTeam: (id: string) => unknown;
    createAgentTeam: (request: CreateAgentTeamRequest) => unknown;
    updateAgentTeam: (id: string, updates: UpdateAgentTeamRequest) => unknown;
    deleteAgentTeam: (id: string) => boolean;
    installDevelopmentTeamTemplate: () => unknown;
  };

  /** Sync OpenClaw config (best-effort, fire-and-forget from renderer perspective). */
  syncOpenClawConfig: (opts: { reason: string; restartGatewayIfRunning?: boolean }) => Promise<unknown>;

  /** Optional: clean up IM bindings referencing a deleted agent. */
  getIMGatewayManager: () => {
    getIMStore: () => {
      getIMSettings: () => { platformAgentBindings?: Record<string, string> };
      setIMSettings: (settings: { platformAgentBindings: Record<string, string> }) => void;
    };
  } | null;
}

export function registerAgentsHandlers(deps: AgentsDeps): void {
  ipcMain.handle('agents:list', async () => {
    try {
      const agents = deps.getAgentManager().listAgents();
      return { success: true, agents };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list agents' };
    }
  });

  ipcMain.handle('agents:get', async (_event, id: string) => {
    try {
      const agent = deps.getAgentManager().getAgent(id);
      return { success: true, agent };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get agent' };
    }
  });

  ipcMain.handle('agents:create', async (_event, request: CreateAgentRequest) => {
    try {
      const agent = deps.getAgentManager().createAgent(request);
      deps.syncOpenClawConfig({ reason: 'agent-created' }).catch(() => {});
      return { success: true, agent };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create agent' };
    }
  });

  ipcMain.handle('agents:update', async (_event, id: string, updates: UpdateAgentRequest) => {
    try {
      const agent = deps.getAgentManager().updateAgent(id, updates);
      deps.syncOpenClawConfig({ reason: 'agent-updated' }).catch(() => {});
      return { success: true, agent };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update agent' };
    }
  });

  ipcMain.handle('agents:delete', async (_event, id: string) => {
    try {
      const result = deps.getAgentManager().deleteAgent(id);

      // Clean up IM platform bindings that reference the deleted agent
      // so that channels fall back to the default 'main' agent.
      try {
        const imStore = deps.getIMGatewayManager()?.getIMStore();
        if (imStore) {
          const imSettings = imStore.getIMSettings();
          const bindings = imSettings.platformAgentBindings;
          if (bindings) {
            let changed = false;
            for (const [platform, agentId] of Object.entries(bindings)) {
              if (agentId === id || agentId === `agent:${id}`) {
                delete bindings[platform];
                changed = true;
              }
            }
            if (changed) {
              imStore.setIMSettings({ platformAgentBindings: bindings });
            }
          }
        }
      } catch {
        // IM store may not be initialised yet; safe to ignore.
      }

      deps.syncOpenClawConfig({ reason: 'agent-deleted' }).catch(() => {});
      return { success: true, deleted: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete agent' };
    }
  });

  ipcMain.handle('agents:presets', async () => {
    try {
      const presets = deps.getAgentManager().getPresetAgents();
      return { success: true, presets };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get presets' };
    }
  });

  ipcMain.handle('agents:addPreset', async (_event, presetId: string) => {
    try {
      const agent = deps.getAgentManager().addPresetAgent(presetId);
      deps.syncOpenClawConfig({ reason: 'agent-preset-added' }).catch(() => {});
      return { success: true, agent };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add preset agent' };
    }
  });

  ipcMain.handle('agents:teams:list', async () => {
    try {
      const teams = deps.getAgentManager().listAgentTeams();
      return { success: true, teams };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list agent teams' };
    }
  });

  ipcMain.handle('agents:teams:get', async (_event, id: string) => {
    try {
      const team = deps.getAgentManager().getAgentTeam(id);
      return { success: true, team };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get agent team' };
    }
  });

  ipcMain.handle('agents:teams:create', async (_event, request: CreateAgentTeamRequest) => {
    try {
      const team = deps.getAgentManager().createAgentTeam(request);
      deps.syncOpenClawConfig({ reason: 'agent-team-created' }).catch(() => {});
      return { success: true, team };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create agent team' };
    }
  });

  ipcMain.handle('agents:teams:update', async (_event, id: string, updates: UpdateAgentTeamRequest) => {
    try {
      const team = deps.getAgentManager().updateAgentTeam(id, updates);
      deps.syncOpenClawConfig({ reason: 'agent-team-updated' }).catch(() => {});
      return { success: true, team };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update agent team' };
    }
  });

  ipcMain.handle('agents:teams:delete', async (_event, id: string) => {
    try {
      const deleted = deps.getAgentManager().deleteAgentTeam(id);
      return { success: true, deleted };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete agent team' };
    }
  });

  ipcMain.handle('agents:teams:installDevelopmentTemplate', async () => {
    try {
      const team = deps.getAgentManager().installDevelopmentTeamTemplate();
      deps.syncOpenClawConfig({ reason: 'agent-team-template-installed' }).catch(() => {});
      return { success: true, team };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to install development team' };
    }
  });
}
