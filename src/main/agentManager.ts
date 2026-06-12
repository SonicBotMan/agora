import {
  buildDevelopmentTeamRequest,
  buildTemplateAgentRequest,
  DEVELOPMENT_TEAM_AGENT_TEMPLATES,
  type DevelopmentTeamAgentTemplate,
  findPresetAgentById,
  getInstallablePresetAgents,
} from './agentManagerSupport';
import type {
  Agent,
  AgentTeam,
  CoworkStore,
  CreateAgentRequest,
  CreateAgentTeamRequest,
  UpdateAgentRequest,
  UpdateAgentTeamRequest,
} from './coworkStore';
import { PRESET_AGENTS, type PresetAgent, presetToCreateRequest } from './presetAgents';

/**
 * AgentManager handles CRUD operations for agents and preset agent installation.
 * Agents are stored in the SQLite `agents` table via CoworkStore.
 */
export class AgentManager {
  private store: CoworkStore;

  constructor(store: CoworkStore) {
    this.store = store;
  }

  listAgents(): Agent[] {
    return this.store.listAgents();
  }

  getAgent(agentId: string): Agent | null {
    return this.store.getAgent(agentId);
  }

  getDefaultAgent(): Agent {
    const agents = this.store.listAgents();
    return agents.find(a => a.isDefault) || agents[0];
  }

  createAgent(request: CreateAgentRequest): Agent {
    return this.store.createAgent(request);
  }

  updateAgent(agentId: string, updates: UpdateAgentRequest): Agent | null {
    return this.store.updateAgent(agentId, updates);
  }

  deleteAgent(agentId: string): boolean {
    return this.store.deleteAgent(agentId);
  }

  listAgentTeams(): AgentTeam[] {
    return this.store.listAgentTeams();
  }

  getAgentTeam(teamId: string): AgentTeam | null {
    return this.store.getAgentTeam(teamId);
  }

  createAgentTeam(request: CreateAgentTeamRequest): AgentTeam {
    return this.store.createAgentTeam(request);
  }

  updateAgentTeam(teamId: string, updates: UpdateAgentTeamRequest): AgentTeam | null {
    return this.store.updateAgentTeam(teamId, updates);
  }

  deleteAgentTeam(teamId: string): boolean {
    return this.store.deleteAgentTeam(teamId);
  }

  // --- Preset agents ---

  getPresetAgents(): PresetAgent[] {
    return getInstallablePresetAgents(PRESET_AGENTS, this.store.listAgents());
  }

  getAllPresetAgents(): PresetAgent[] {
    return PRESET_AGENTS;
  }

  addPresetAgent(presetId: string): Agent | null {
    const preset = findPresetAgentById(PRESET_AGENTS, presetId);
    if (!preset) return null;

    // Check if already installed
    const existing = this.store.getAgent(preset.id);
    if (existing) return existing;

    return this.store.createAgent(presetToCreateRequest(preset));
  }

  installDevelopmentTeamTemplate(): AgentTeam {
    const members = DEVELOPMENT_TEAM_AGENT_TEMPLATES.map((template) =>
      this.ensureTemplateAgent(template),
    );

    const existing = this.store.getAgentTeam('development-team');
    const teamRequest = buildDevelopmentTeamRequest(members);

    if (existing) {
      return this.store.updateAgentTeam(existing.id, teamRequest) || existing;
    }
    return this.store.createAgentTeam(teamRequest);
  }

  private ensureTemplateAgent(template: DevelopmentTeamAgentTemplate): Agent {
    const existing = this.store.getAgent(template.id);
    const request = buildTemplateAgentRequest(template);
    if (existing) {
      return this.store.updateAgent(template.id, request) || existing;
    }
    return this.store.createAgent(request);
  }
}
