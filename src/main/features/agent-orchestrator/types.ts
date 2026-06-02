/**
 * Agora — Agent Orchestrator Types
 * DAG-based multi-agent task orchestration.
 */

export interface TaskNode {
  id: string;
  agentEngine: string;
  agentId?: string;
  prompt: string;
  dependsOn: string[];
  timeout?: number;
  retry?: { maxAttempts: number; delay: number };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskGraph {
  id: string;
  name: string;
  description: string;
  nodes: TaskNode[];
  source: 'auto' | 'manual' | 'template';
  createdAt: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  graph: Omit<TaskGraph, 'id' | 'createdAt' | 'status'>;
}

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {};
