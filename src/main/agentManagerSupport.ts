import {
  AgentTeamWorkflow,
  CoworkAgentEngine,
} from '../shared/cowork/constants';
import type {
  Agent,
  CreateAgentRequest,
  CreateAgentTeamRequest,
} from './coworkStore';
import type { PresetAgent } from './presetAgents';

export interface DevelopmentTeamAgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  role: string;
  systemPrompt: string;
  agentEngine: CoworkAgentEngine;
}

export const DEVELOPMENT_TEAM_AGENT_TEMPLATES: DevelopmentTeamAgentTemplate[] =
  [
    {
      id: 'team-product-manager',
      name: '产品经理',
      description: '负责需求澄清、范围拆解和验收标准。',
      icon: '🧭',
      role: '产品经理',
      agentEngine: CoworkAgentEngine.ClaudeCode,
      systemPrompt: [
        '你是开发团队中的产品经理。',
        '你的职责是澄清需求、拆分任务、识别风险，并输出清晰的验收标准。',
        '请保持简洁，优先给开发工程师可执行的任务拆解。',
      ].join('\n'),
    },
    {
      id: 'team-developer',
      name: '开发工程师',
      description: '负责阅读代码、实现需求、修改文件和解释关键变更。',
      icon: '💻',
      role: '开发工程师',
      agentEngine: CoworkAgentEngine.Codex,
      systemPrompt: [
        '你是开发团队中的开发工程师。',
        '你的职责是理解需求、阅读现有代码、做最小必要实现，并说明关键文件变更。',
        '完成后给测试工程师留下可验证的检查点。',
      ].join('\n'),
    },
    {
      id: 'team-test-engineer',
      name: '测试工程师',
      description: '负责验证变更、回归风险和测试建议。',
      icon: '🧪',
      role: '测试工程师',
      agentEngine: CoworkAgentEngine.Codex,
      systemPrompt: [
        '你是开发团队中的测试工程师。',
        '你的职责是验证开发结果、运行可用测试、指出回归风险，并给出下一步验证建议。',
        '如果无法运行测试，请说明原因和人工验证路径。',
      ].join('\n'),
    },
  ];

export function getInstallablePresetAgents(
  presetAgents: PresetAgent[],
  existingAgents: Array<Pick<Agent, 'source' | 'presetId'>>,
): PresetAgent[] {
  const existingPresetIds = new Set(
    existingAgents
      .filter((agent) => agent.source === 'preset')
      .map((agent) => agent.presetId),
  );

  return presetAgents.filter((preset) => !existingPresetIds.has(preset.id));
}

export function findPresetAgentById(
  presetAgents: PresetAgent[],
  presetId: string,
): PresetAgent | null {
  return presetAgents.find((preset) => preset.id === presetId) ?? null;
}

export function buildTemplateAgentRequest(
  template: DevelopmentTeamAgentTemplate,
): CreateAgentRequest {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    systemPrompt: template.systemPrompt,
    agentEngine: template.agentEngine,
    source: 'preset',
    presetId: template.id,
  };
}

export function buildDevelopmentTeamRequest(
  members: Array<Pick<Agent, 'id'>>,
  templates: DevelopmentTeamAgentTemplate[] = DEVELOPMENT_TEAM_AGENT_TEMPLATES,
): CreateAgentTeamRequest {
  return {
    id: 'development-team',
    name: '开发团队',
    description: '产品经理、开发工程师、测试工程师串行协作。',
    icon: '👥',
    leadAgentId: members[0]?.id,
    members: members.map((agent, index) => ({
      agentId: agent.id,
      role: templates[index]?.role ?? `成员${index + 1}`,
      order: index,
    })),
    defaultWorkflow: AgentTeamWorkflow.LeadSequential,
    source: 'preset',
    presetId: 'development-team',
  };
}
