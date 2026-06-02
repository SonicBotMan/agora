/**
 * Type definitions for the Agent Orchestrator feature.
 */

import type { CoworkAgentEngine } from '../../shared/cowork/constants';

// ── CoworkRuntime (local subset) ───────────────────────────────────────────

/**
 * Minimal CoworkRuntime interface matching the subset used by the orchestrator.
 * Full definition lives in src/main/libs/agentEngine/types.ts.
 */
export interface CoworkRuntime {
  startSession(sessionId: string, prompt: string, options?: { agentEngine?: string; agentId?: string }): Promise<void>;
  stopSession(sessionId: string): void;
  isSessionActive?(sessionId: string): boolean;
}

// ── Task Node ──────────────────────────────────────────────────────────────

export type TaskNodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface TaskNode {
  id: string;
  agentEngine: CoworkAgentEngine;
  agentId?: string;
  prompt: string;
  dependsOn: string[];
  timeout?: number;           // ms
  retry?: number;             // max retry attempts
  status: TaskNodeStatus;
  result?: string;
  error?: string;
}

// ── Task Graph ─────────────────────────────────────────────────────────────

export type TaskGraphSource = 'auto' | 'manual' | 'template';

export interface TaskGraph {
  id: string;
  name: string;
  description: string;
  nodes: TaskNode[];
  source: TaskGraphSource;
  createdAt: string;          // ISO-8601
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ── Orchestrator Events ────────────────────────────────────────────────────

export type OrchestratorEventType =
  | 'plan:start'
  | 'plan:complete'
  | 'execute:node-start'
  | 'execute:node-complete'
  | 'execute:node-failed'
  | 'execute:node-cancelled'
  | 'execute:node-retrying'
  | 'execute:complete'
  | 'execute:failed'
  | 'aggregate:complete'
  | 'error';

export interface OrchestratorEvent {
  type: OrchestratorEventType;
  graphId: string;
  nodeId?: string;
  timestamp: string;
  payload?: unknown;
}

// ── Workflow Template ──────────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  createGraph: (goal: string, context?: string) => TaskGraph;
}

// ── Agent Pool ─────────────────────────────────────────────────────────────

export interface AgentRegistration {
  engine: CoworkAgentEngine;
  agentId?: string;
  label: string;
  available: boolean;
}

// ── Aggregation ────────────────────────────────────────────────────────────

export interface ConflictInfo {
  nodeIds: string[];
  description: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AggregateResult {
  summary: string;
  conflicts: ConflictInfo[];
  rawResults: Record<string, string>;
}
