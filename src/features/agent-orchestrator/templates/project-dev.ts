/**
 * project-dev template — development project workflow.
 * Decomposes a development goal into standard backend/frontend/test/deploy tasks.
 */

import type { WorkflowTemplate, TaskGraph, TaskNode } from '../types';
import { CoworkAgentEngine } from '../../../shared/cowork/constants';

function createGraph(goal: string, _context?: string): TaskGraph {
  const now = new Date().toISOString();

  const nodes: TaskNode[] = [
    {
      id: 'requirements-analysis',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `分析以下开发需求，输出清晰的需求规格说明：\n\n${goal}`,
      dependsOn: [],
      status: 'pending',
    },
    {
      id: 'architecture-design',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `基于需求分析结果，设计系统架构，包括模块划分、数据流和技术选型。`,
      dependsOn: ['requirements-analysis'],
      status: 'pending',
    },
    {
      id: 'backend-implementation',
      agentEngine: CoworkAgentEngine.ClaudeCode,
      prompt: `根据架构设计实现后端代码。`,
      dependsOn: ['architecture-design'],
      timeout: 300_000,
      retry: 1,
      status: 'pending',
    },
    {
      id: 'frontend-implementation',
      agentEngine: CoworkAgentEngine.ClaudeCode,
      prompt: `根据架构设计实现前端代码。`,
      dependsOn: ['architecture-design'],
      timeout: 300_000,
      retry: 1,
      status: 'pending',
    },
    {
      id: 'testing',
      agentEngine: CoworkAgentEngine.Codex,
      prompt: `编写并执行集成测试和单元测试。`,
      dependsOn: ['backend-implementation', 'frontend-implementation'],
      status: 'pending',
    },
    {
      id: 'deployment',
      agentEngine: CoworkAgentEngine.Hermes,
      prompt: `准备部署配置并输出部署说明。`,
      dependsOn: ['testing'],
      status: 'pending',
    },
  ];

  return {
    id: `project-dev-${Date.now()}`,
    name: 'Project Development',
    description: `Development workflow for: ${goal.substring(0, 80)}`,
    nodes,
    source: 'template',
    createdAt: now,
    status: 'pending',
  };
}

export const projectDevTemplate: WorkflowTemplate = {
  id: 'project-dev',
  name: 'Project Development',
  description: 'Standards-based development workflow: requirements → architecture → implementation → testing → deployment',
  createGraph,
};
