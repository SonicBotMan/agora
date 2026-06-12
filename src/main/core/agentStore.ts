import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

import {
  AgentTeamWorkflow,
  isAgentTeamWorkflow,
} from '../../shared/cowork/constants';
import type {
  Agent,
  AgentSource,
  AgentTeam,
  AgentTeamMember,
  CreateAgentRequest,
  CreateAgentTeamRequest,
  UpdateAgentRequest,
  UpdateAgentTeamRequest,
} from '../coworkStoreTypes';
import { normalizeCoworkAgentEngineValue } from './configManager';

interface AgentRow {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  identity: string;
  model: string;
  agent_engine?: string | null;
  icon: string;
  skill_ids: string;
  enabled: number;
  is_default: number;
  source: string;
  preset_id: string;
  created_at: number;
  updated_at: number;
}

interface AgentTeamRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  lead_agent_id: string;
  members: string;
  default_workflow: string;
  skill_ids: string;
  enabled: number;
  source: string;
  preset_id: string;
  created_at: number;
  updated_at: number;
}

function normalizeAgentTeamMembers(value: unknown): AgentTeamMember[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): AgentTeamMember | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const agentId = typeof record.agentId === 'string' && record.agentId.trim()
        ? record.agentId.trim()
        : null;
      if (!agentId) return null;
      const role = typeof record.role === 'string' ? record.role.trim() : '';
      const orderValue = typeof record.order === 'number' && Number.isFinite(record.order)
        ? Math.floor(record.order)
        : index;
      return { agentId, role, order: orderValue };
    })
    .filter((item): item is AgentTeamMember => Boolean(item))
    .sort((left, right) => left.order - right.order)
    .map((item, index) => ({ ...item, order: index }));
}

export class AgentStore {
  constructor(private db: Database.Database) {}

  private getOne<T>(
    sql: string,
    params: (string | number | null)[] = [],
  ): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  private getAll<T>(
    sql: string,
    params: (string | number | null)[] = [],
  ): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  listAgents(): Agent[] {
    const rows = this.getAll<AgentRow>(`
      SELECT * FROM agents ORDER BY is_default DESC, created_at ASC
    `);

    return rows.map((row) => this.mapAgentRow(row));
  }

  getAgent(id: string): Agent | null {
    const row = this.getOne<AgentRow>(`SELECT * FROM agents WHERE id = ?`, [id]);
    if (!row) return null;
    return this.mapAgentRow(row);
  }

  createAgent(request: CreateAgentRequest): Agent {
    const id =
      request.id
      || request.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      || uuidv4();
    const now = Date.now();

    const existing = this.getAgent(id);
    if (existing) {
      return this.createAgent({ ...request, id: `${id}-${Date.now()}` });
    }

    this.db
      .prepare(
        `
      INSERT INTO agents (id, name, description, system_prompt, identity, model, agent_engine, icon, skill_ids, enabled, is_default, source, preset_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        request.name,
        request.description || '',
        request.systemPrompt || '',
        request.identity || '',
        request.model || '',
        normalizeCoworkAgentEngineValue(request.agentEngine),
        request.icon || '',
        JSON.stringify(request.skillIds || []),
        request.source || 'custom',
        request.presetId || '',
        now,
        now,
      );

    return this.getAgent(id)!;
  }

  updateAgent(id: string, updates: UpdateAgentRequest): Agent | null {
    const existing = this.getAgent(id);
    if (!existing) return null;

    const now = Date.now();
    const setClauses: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description);
    }
    if (updates.systemPrompt !== undefined) {
      setClauses.push('system_prompt = ?');
      values.push(updates.systemPrompt);
    }
    if (updates.identity !== undefined) {
      setClauses.push('identity = ?');
      values.push(updates.identity);
    }
    if (updates.model !== undefined) {
      setClauses.push('model = ?');
      values.push(updates.model);
    }
    if (updates.agentEngine !== undefined) {
      setClauses.push('agent_engine = ?');
      values.push(normalizeCoworkAgentEngineValue(updates.agentEngine));
    }
    if (updates.icon !== undefined) {
      setClauses.push('icon = ?');
      values.push(updates.icon);
    }
    if (updates.skillIds !== undefined) {
      setClauses.push('skill_ids = ?');
      values.push(JSON.stringify(updates.skillIds));
    }
    if (updates.enabled !== undefined) {
      setClauses.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    values.push(id);
    this.db.prepare(`UPDATE agents SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    return this.getAgent(id);
  }

  deleteAgent(id: string): boolean {
    if (id === 'main') return false;
    this.db.prepare('DELETE FROM agents WHERE id = ? AND is_default = 0').run(id);
    return true;
  }

  listAgentTeams(): AgentTeam[] {
    const rows = this.getAll<AgentTeamRow>(`
      SELECT * FROM agent_teams
      ORDER BY created_at ASC
    `);
    return rows.map((row) => this.mapAgentTeamRow(row));
  }

  getAgentTeam(id: string): AgentTeam | null {
    const row = this.getOne<AgentTeamRow>('SELECT * FROM agent_teams WHERE id = ?', [id]);
    return row ? this.mapAgentTeamRow(row) : null;
  }

  createAgentTeam(request: CreateAgentTeamRequest): AgentTeam {
    const id =
      request.id
      || request.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      || uuidv4();
    const existing = this.getAgentTeam(id);
    if (existing) {
      return this.createAgentTeam({ ...request, id: `${id}-${Date.now()}` });
    }

    const now = Date.now();
    const members = normalizeAgentTeamMembers(request.members || []);
    const leadAgentId = request.leadAgentId || members[0]?.agentId || 'main';
    const workflow = isAgentTeamWorkflow(request.defaultWorkflow)
      ? request.defaultWorkflow
      : AgentTeamWorkflow.LeadSequential;

    this.db
      .prepare(
        `
      INSERT INTO agent_teams (id, name, description, icon, lead_agent_id, members, default_workflow, skill_ids, enabled, source, preset_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        request.name,
        request.description || '',
        request.icon || '',
        leadAgentId,
        JSON.stringify(members),
        workflow,
        JSON.stringify(request.skillIds || []),
        request.source || 'custom',
        request.presetId || '',
        now,
        now,
      );

    return this.getAgentTeam(id)!;
  }

  updateAgentTeam(id: string, updates: UpdateAgentTeamRequest): AgentTeam | null {
    const existing = this.getAgentTeam(id);
    if (!existing) return null;

    const now = Date.now();
    const setClauses: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description);
    }
    if (updates.icon !== undefined) {
      setClauses.push('icon = ?');
      values.push(updates.icon);
    }
    if (updates.leadAgentId !== undefined) {
      setClauses.push('lead_agent_id = ?');
      values.push(updates.leadAgentId);
    }
    if (updates.members !== undefined) {
      setClauses.push('members = ?');
      values.push(JSON.stringify(normalizeAgentTeamMembers(updates.members)));
    }
    if (updates.defaultWorkflow !== undefined) {
      setClauses.push('default_workflow = ?');
      values.push(
        isAgentTeamWorkflow(updates.defaultWorkflow)
          ? updates.defaultWorkflow
          : AgentTeamWorkflow.LeadSequential,
      );
    }
    if (updates.skillIds !== undefined) {
      setClauses.push('skill_ids = ?');
      values.push(JSON.stringify(updates.skillIds));
    }
    if (updates.enabled !== undefined) {
      setClauses.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    values.push(id);
    this.db.prepare(`UPDATE agent_teams SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getAgentTeam(id);
  }

  deleteAgentTeam(id: string): boolean {
    this.db.prepare('DELETE FROM agent_teams WHERE id = ?').run(id);
    return true;
  }

  private mapAgentRow(row: AgentRow): Agent {
    let skillIds: string[] = [];
    try {
      skillIds = JSON.parse(row.skill_ids);
    } catch {
      skillIds = [];
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      identity: row.identity,
      model: row.model,
      agentEngine: normalizeCoworkAgentEngineValue(row.agent_engine),
      icon: row.icon,
      skillIds,
      enabled: Boolean(row.enabled),
      isDefault: Boolean(row.is_default),
      source: row.source as AgentSource,
      presetId: row.preset_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAgentTeamRow(row: AgentTeamRow): AgentTeam {
    let members: AgentTeamMember[] = [];
    try {
      members = normalizeAgentTeamMembers(JSON.parse(row.members));
    } catch {
      members = [];
    }

    let skillIds: string[] = [];
    try {
      const parsed = JSON.parse(row.skill_ids);
      skillIds = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      skillIds = [];
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      leadAgentId: row.lead_agent_id,
      members,
      defaultWorkflow: isAgentTeamWorkflow(row.default_workflow)
        ? row.default_workflow
        : AgentTeamWorkflow.LeadSequential,
      skillIds,
      enabled: Boolean(row.enabled),
      source: row.source as AgentSource,
      presetId: row.preset_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
