/**
 * Agent Orchestrator — barrel exports.
 */

export { AgentPool } from './AgentPool';
export type { OrchestratorOptions } from './Orchestrator';
export { Orchestrator } from './Orchestrator';
export { TaskGraphHelper } from './TaskGraph';
export { TaskResultAggregator } from './TaskResultAggregator';
export type { SchedulerOptions } from './TaskScheduler';
export { TaskScheduler } from './TaskScheduler';
export {
  builtInTemplates,
  deepInvestigationTemplate,
  planDesignTemplate,
  projectDevTemplate,
} from './templates/index';
export type {
  AgentRegistration,
  AggregateResult,
  ConflictInfo,
  OrchestratorEvent,
  OrchestratorEventType,
  TaskGraph,
  TaskGraphSource,
  TaskNode,
  TaskNodeStatus,
  WorkflowTemplate,
} from './types';
