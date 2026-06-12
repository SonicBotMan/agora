/**
 * plan-design template — program planning and design workflow.
 * Decomposes a planning goal into research → brainstorming → evaluation → final plan.
 */

import { CoworkAgentEngine } from '../../../shared/cowork/constants';
import type { TaskGraph, TaskNode,WorkflowTemplate } from '../types';

function createGraph(goal: string, _context?: string): TaskGraph {
  const now = new Date().toISOString();

  const nodes: TaskNode[] = [
    {
      id: 'background-research',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `对以下策划目标进行背景调研，收集相关信息和最佳实践：\n\n${goal}`,
      dependsOn: [],
      status: 'pending',
    },
    {
      id: 'competitive-analysis',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `对同类方案或竞品进行分析，找出差异化和机会点。`,
      dependsOn: ['background-research'],
      status: 'pending',
    },
    {
      id: 'brainstorming',
      agentEngine: CoworkAgentEngine.OpenClaw,
      prompt: `基于调研结果，进行头脑风暴，提出至少 3 个创意方向。`,
      dependsOn: ['background-research'],
      status: 'pending',
    },
    {
      id: 'feasibility-evaluation',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `对每个创意方向进行可行性评估，包括技术、资源、时间维度。`,
      dependsOn: ['brainstorming', 'competitive-analysis'],
      status: 'pending',
    },
    {
      id: 'final-plan',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `综合所有分析结果，输出最终方案策划书。`,
      dependsOn: ['feasibility-evaluation'],
      status: 'pending',
    },
  ];

  return {
    id: `plan-design-${Date.now()}`,
    name: 'Plan & Design',
    description: `Planning workflow for: ${goal.substring(0, 80)}`,
    nodes,
    source: 'template',
    createdAt: now,
    status: 'pending',
  };
}

export const planDesignTemplate: WorkflowTemplate = {
  id: 'plan-design',
  name: 'Plan & Design',
  description: 'Comprehensive planning workflow: research → competitive analysis → brainstorming → feasibility → final plan',
  createGraph,
};
