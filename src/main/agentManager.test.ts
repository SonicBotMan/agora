import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';
import { AgentManager } from './agentManager';
import { setLanguage } from './i18n';

type MockStore = {
  listAgents: ReturnType<typeof vi.fn>;
  getAgent: ReturnType<typeof vi.fn>;
  createAgent: ReturnType<typeof vi.fn>;
  updateAgent: ReturnType<typeof vi.fn>;
  deleteAgent: ReturnType<typeof vi.fn>;
  listAgentTeams: ReturnType<typeof vi.fn>;
  getAgentTeam: ReturnType<typeof vi.fn>;
  createAgentTeam: ReturnType<typeof vi.fn>;
  updateAgentTeam: ReturnType<typeof vi.fn>;
  deleteAgentTeam: ReturnType<typeof vi.fn>;
};

function createStore(): MockStore {
  return {
    listAgents: vi.fn().mockReturnValue([]),
    getAgent: vi.fn().mockReturnValue(null),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    listAgentTeams: vi.fn().mockReturnValue([]),
    getAgentTeam: vi.fn().mockReturnValue(null),
    createAgentTeam: vi.fn(),
    updateAgentTeam: vi.fn(),
    deleteAgentTeam: vi.fn(),
  };
}

function buildStoredAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    name: 'Agent',
    description: 'desc',
    systemPrompt: 'prompt',
    identity: '',
    model: '',
    agentEngine: CoworkAgentEngine.ClaudeCode,
    icon: '🧠',
    skillIds: [],
    enabled: true,
    isDefault: false,
    source: 'custom',
    presetId: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function buildStoredAgentTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: 'development-team',
    name: '开发团队',
    description: 'desc',
    icon: '👥',
    leadAgentId: 'team-product-manager',
    members: [],
    defaultWorkflow: 'lead_sequential',
    skillIds: [],
    enabled: true,
    source: 'preset',
    presetId: 'development-team',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('agentManager', () => {
  beforeEach(() => {
    setLanguage('zh');
  });

  it('returns the default agent or falls back to the first agent', () => {
    const store = createStore();
    store.listAgents.mockReturnValue([
      buildStoredAgent({ id: 'first', isDefault: false }),
      buildStoredAgent({ id: 'default', isDefault: true }),
    ]);
    const manager = new AgentManager(store as never);

    expect(manager.getDefaultAgent().id).toBe('default');

    store.listAgents.mockReturnValue([
      buildStoredAgent({ id: 'first', isDefault: false }),
      buildStoredAgent({ id: 'second', isDefault: false }),
    ]);

    expect(manager.getDefaultAgent().id).toBe('first');
  });

  it('filters preset agents that are already installed from preset sources only', () => {
    const store = createStore();
    store.listAgents.mockReturnValue([
      buildStoredAgent({ source: 'preset', presetId: 'stockexpert' }),
      buildStoredAgent({ source: 'custom', presetId: 'content-writer' }),
    ]);
    const manager = new AgentManager(store as never);

    const presets = manager.getPresetAgents();

    expect(presets.some((preset) => preset.id === 'stockexpert')).toBe(false);
    expect(presets.some((preset) => preset.id === 'content-writer')).toBe(true);
  });

  it('adds preset agents using the active language and returns existing installs unchanged', () => {
    const store = createStore();
    store.createAgent.mockImplementation((request) =>
      buildStoredAgent({ ...request }),
    );
    const manager = new AgentManager(store as never);

    setLanguage('en');
    const created = manager.addPresetAgent('stockexpert');

    expect(created).toMatchObject({
      id: 'stockexpert',
      name: 'Stock Expert',
      source: 'preset',
      presetId: 'stockexpert',
    });
    expect(store.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stockexpert',
        name: 'Stock Expert',
      }),
    );

    const existing = buildStoredAgent({ id: 'stockexpert', source: 'preset' });
    store.getAgent.mockReturnValueOnce(existing);

    expect(manager.addPresetAgent('stockexpert')).toBe(existing);
    expect(manager.addPresetAgent('missing-preset')).toBeNull();
  });

  it('installs the development team template by upserting template agents and creating the team', () => {
    const store = createStore();
    store.createAgent.mockImplementation((request) =>
      buildStoredAgent({ ...request }),
    );
    store.createAgentTeam.mockImplementation((request) =>
      buildStoredAgentTeam({ ...request }),
    );
    const manager = new AgentManager(store as never);

    const team = manager.installDevelopmentTeamTemplate();

    expect(store.createAgent).toHaveBeenCalledTimes(3);
    expect(store.createAgentTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'development-team',
        leadAgentId: 'team-product-manager',
        members: [
          { agentId: 'team-product-manager', role: '产品经理', order: 0 },
          { agentId: 'team-developer', role: '开发工程师', order: 1 },
          { agentId: 'team-test-engineer', role: '测试工程师', order: 2 },
        ],
      }),
    );
    expect(team).toMatchObject({
      id: 'development-team',
      leadAgentId: 'team-product-manager',
    });
  });

  it('updates existing template agents and falls back to the persisted team when team update returns null', () => {
    const store = createStore();
    store.getAgent.mockImplementation((agentId: string) =>
      buildStoredAgent({ id: agentId, source: 'preset', presetId: agentId }),
    );
    const existingTeam = buildStoredAgentTeam({
      name: '旧开发团队',
    });
    store.getAgentTeam.mockReturnValue(existingTeam);
    store.updateAgent.mockImplementation((agentId: string, request) =>
      buildStoredAgent({ id: agentId, ...request }),
    );
    store.updateAgentTeam.mockReturnValue(null);
    const manager = new AgentManager(store as never);

    const team = manager.installDevelopmentTeamTemplate();

    expect(store.updateAgent).toHaveBeenCalledTimes(3);
    expect(store.createAgent).not.toHaveBeenCalled();
    expect(store.updateAgentTeam).toHaveBeenCalledWith(
      'development-team',
      expect.objectContaining({
        id: 'development-team',
        leadAgentId: 'team-product-manager',
      }),
    );
    expect(team).toBe(existingTeam);
  });
});
