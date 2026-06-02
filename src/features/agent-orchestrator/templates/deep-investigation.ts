/**
 * deep-investigation template — deep investigation workflow.
 * Decomposes a research goal into multi-angle evidence gathering, cross-validation, and synthesis.
 */

import type { WorkflowTemplate, TaskGraph, TaskNode } from '../types';
import { CoworkAgentEngine } from '../../../shared/cowork/constants';

function createGraph(goal: string, _context?: string): TaskGraph {
  const now = new Date().toISOString();

  const nodes: TaskNode[] = [
    {
      id: 'define-scope',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `定义以下调研课题的范围、关键问题和成功标准：\n\n${goal}`,
      dependsOn: [],
      status: 'pending',
    },
    {
      id: 'angle-web',
      agentEngine: CoworkAgentEngine.Codex,
      prompt: `从互联网公开信息角度收集资料和证据。`,
      dependsOn: ['define-scope'],
      timeout: 180_000,
      status: 'pending',
    },
    {
      id: 'angle-scholar',
      agentEngine: CoworkAgentEngine.Codex,
      prompt: `从学术研究和论文角度收集资料和证据。`,
      dependsOn: ['define-scope'],
      timeout: 180_000,
      status: 'pending',
    },
    {
      id: 'angle-social',
      agentEngine: CoworkAgentEngine.Codex,
      prompt: `从社交媒体和社区讨论角度收集观点和趋势。`,
      dependsOn: ['define-scope'],
      timeout: 180_000,
      status: 'pending',
    },
    {
      id: 'cross-validation',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `对以上三个角度的发现进行交叉验证，识别共识点和矛盾点。`,
      dependsOn: ['angle-web', 'angle-scholar', 'angle-social'],
      status: 'pending',
    },
    {
      id: 'synthesis-report',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `综合所有验证过的发现，输出深度调研报告，包含结论、证据链和不确定性说明。`,
      dependsOn: ['cross-validation'],
      status: 'pending',
    },
  ];

  return {
    id: `deep-investigation-${Date.now()}`,
    name: 'Deep Investigation',
    description: `Deep investigation workflow for: ${goal.substring(0, 80)}`,
    nodes,
    source: 'template',
    createdAt: now,
    status: 'pending',
  };
}

export const deepInvestigationTemplate: WorkflowTemplate = {
  id: 'deep-investigation',
  name: 'Deep Investigation',
  description: 'Multi-angle deep investigation: scope → web/scholar/social angles → cross-validation → synthesis report',
  createGraph,
};
