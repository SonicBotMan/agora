/**
 * Agent Orchestrator — barrel exports.
 */

export { Orchestrator } from './Orchestrator';
export type { OrchestratorOptions } from './Orchestrator';

export { TaskGraphHelper } from './TaskGraph';
export { TaskScheduler } from './TaskScheduler';
export type { SchedulerOptions } from './TaskScheduler';

export { AgentPool } from './AgentPool';
export { TaskResultAggregator } from './TaskResultAggregator';

export type {
  TaskNode,
  TaskNodeStatus,
  TaskGraph,
  TaskGraphSource,
  OrchestratorEvent,
  OrchestratorEventType,
  WorkflowTemplate,
  AgentRegistration,
  ConflictInfo,
  AggregateResult,
} from './types';

export {
  projectDevTemplate,
  planDesignTemplate,
  deepInvestigationTemplate,
  builtInTemplates,
} from './templates/index';
