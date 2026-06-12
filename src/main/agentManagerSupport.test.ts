import { describe, expect, it } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';
import {
  buildDevelopmentTeamRequest,
  buildTemplateAgentRequest,
  DEVELOPMENT_TEAM_AGENT_TEMPLATES,
  findPresetAgentById,
  getInstallablePresetAgents,
} from './agentManagerSupport';
import type { PresetAgent } from './presetAgents';

const presets: PresetAgent[] = [
  {
    id: 'planner',
    name: '规划助手',
    nameEn: 'Planner',
    icon: '🧭',
    description: '中文描述',
    descriptionEn: 'English description',
    systemPrompt: '中文提示词',
    systemPromptEn: 'English prompt',
    skillIds: ['web-search'],
  },
  {
    id: 'writer',
    name: '写作助手',
    nameEn: 'Writer',
    icon: '✍️',
    description: '中文写作描述',
    descriptionEn: 'English writing description',
    systemPrompt: '中文写作提示词',
    systemPromptEn: 'English writing prompt',
    skillIds: ['article-writer'],
  },
];

describe('agentManagerSupport', () => {
  it('filters installable presets using only persisted preset agents', () => {
    expect(
      getInstallablePresetAgents(presets, [
        { source: 'preset', presetId: 'planner' },
        { source: 'custom', presetId: 'writer' },
      ]),
    ).toEqual([presets[1]]);
  });

  it('finds presets by id and returns null for unknown ids', () => {
    expect(findPresetAgentById(presets, 'writer')).toBe(presets[1]);
    expect(findPresetAgentById(presets, 'missing')).toBeNull();
  });

  it('builds template agent requests with preset metadata', () => {
    expect(
      buildTemplateAgentRequest(DEVELOPMENT_TEAM_AGENT_TEMPLATES[0]),
    ).toEqual({
      id: 'team-product-manager',
      name: '产品经理',
      description: '负责需求澄清、范围拆解和验收标准。',
      icon: '🧭',
      systemPrompt: expect.stringContaining('产品经理'),
      agentEngine: CoworkAgentEngine.ClaudeCode,
      source: 'preset',
      presetId: 'team-product-manager',
    });
  });

  it('builds the development team request with ordered members and roles', () => {
    expect(
      buildDevelopmentTeamRequest([
        { id: 'team-product-manager' },
        { id: 'team-developer' },
        { id: 'team-test-engineer' },
      ] as never),
    ).toEqual({
      id: 'development-team',
      name: '开发团队',
      description: '产品经理、开发工程师、测试工程师串行协作。',
      icon: '👥',
      leadAgentId: 'team-product-manager',
      members: [
        { agentId: 'team-product-manager', role: '产品经理', order: 0 },
        { agentId: 'team-developer', role: '开发工程师', order: 1 },
        { agentId: 'team-test-engineer', role: '测试工程师', order: 2 },
      ],
      defaultWorkflow: 'lead_sequential',
      source: 'preset',
      presetId: 'development-team',
    });
  });
});
