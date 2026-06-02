/**
 * Orchestrator — core agent orchestrator.
 *
 * Plans a goal into a TaskGraph (skeleton, TODO: LLM integration),
 * executes nodes via the TaskScheduler, aggregates results,
 * and provides runtime intervention methods.
 */

import { EventEmitter } from 'events';

import type {
  TaskGraph,
  TaskNode,
  OrchestratorEvent,
  AggregateResult,
  WorkflowTemplate,
  CoworkRuntime,
} from './types';
import { TaskGraphHelper } from './TaskGraph';
import { TaskScheduler } from './TaskScheduler';
import { TaskResultAggregator } from './TaskResultAggregator';
import { AgentPool } from './AgentPool';
import { builtInTemplates } from './templates/index';
import { CoworkAgentEngine } from '../../shared/cowork/constants';

export interface OrchestratorOptions {
  runtime: CoworkRuntime;
  agentPool?: AgentPool;
  maxConcurrency?: number;
  defaultTimeout?: number;
}

export class Orchestrator extends EventEmitter {
  private runtime: CoworkRuntime;
  private agentPool: AgentPool;
  private scheduler: TaskScheduler;
  private aggregator: TaskResultAggregator;
  private templates: Map<string, WorkflowTemplate>;

  /** Active graphs being executed. */
  private activeGraphs: Map<string, TaskGraph> = new Map();

  constructor(options: OrchestratorOptions) {
    super();
    this.runtime = options.runtime;
    this.agentPool = options.agentPool ?? new AgentPool();
    this.scheduler = new TaskScheduler(this.runtime, this.agentPool, {
      maxConcurrency: options.maxConcurrency,
      defaultTimeout: options.defaultTimeout,
    });
    this.aggregator = new TaskResultAggregator();

    // Load built-in templates
    this.templates = new Map();
    for (const tmpl of builtInTemplates) {
      this.templates.set(tmpl.id, tmpl);
    }

    // Forward scheduler events as orchestrator events
    this.scheduler.on('orchestrator:event', (event: OrchestratorEvent) => {
      this.emit('orchestrator:event', event);
    });
  }

  // ── Template Management ──────────────────────────────────────────────────

  /** Register a custom workflow template. */
  registerTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  /** Get a template by id. */
  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  /** List all available templates. */
  listTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  // ── Planning ─────────────────────────────────────────────────────────────

  /**
   * Plan: decompose a goal into a TaskGraph.
   *
   * TODO: Integrate with LLM to intelligently decompose goals.
   * Current implementation returns a simple single-node graph as a skeleton.
   */
  async plan(goal: string, context?: string, templateId?: string): Promise<TaskGraph> {
    this.emit('orchestrator:event', {
      type: 'plan:start',
      graphId: '',
      timestamp: new Date().toISOString(),
      payload: { goal, templateId },
    } satisfies OrchestratorEvent);

    let graph: TaskGraph;

    if (templateId && this.templates.has(templateId)) {
      // Use a template to generate the graph
      const tmpl = this.templates.get(templateId)!;
      graph = tmpl.createGraph(goal, context);
    } else {
      // Fallback: create a simple single-node graph as skeleton
      const now = new Date().toISOString();
      const node: TaskNode = {
        id: 'task-1',
        agentEngine: CoworkAgentEngine.Hermes,
        prompt: goal,
        dependsOn: [],
        timeout: 120_000,
        retry: 0,
        status: 'pending',
        // TODO: Use LLM to decompose goal into structured sub-tasks
      };

      graph = {
        id: `plan-${Date.now()}`,
        name: 'Auto Plan',
        description: goal.substring(0, 200),
        nodes: [node],
        source: context ? 'manual' : 'auto',
        createdAt: now,
        status: 'pending',
      };
    }

    this.activeGraphs.set(graph.id, graph);

    this.emit('orchestrator:event', {
      type: 'plan:complete',
      graphId: graph.id,
      timestamp: new Date().toISOString(),
      payload: { nodeCount: graph.nodes.length },
    } satisfies OrchestratorEvent);

    return graph;
  }

  // ── Execution ────────────────────────────────────────────────────────────

  /**
   * Execute a TaskGraph — schedules all nodes and waits for completion.
   */
  async execute(graph: TaskGraph): Promise<TaskGraph> {
    this.activeGraphs.set(graph.id, graph);
    const result = await this.scheduler.execute(graph);
    this.activeGraphs.set(result.id, result);
    return result;
  }

  // ── Aggregation ──────────────────────────────────────────────────────────

  /**
   * Aggregate results from all completed nodes in the graph.
   */
  aggregate(graph: TaskGraph): string {
    const result: AggregateResult = this.aggregator.aggregate(graph);

    this.emit('orchestrator:event', {
      type: 'aggregate:complete',
      graphId: graph.id,
      timestamp: new Date().toISOString(),
      payload: {
        conflicts: result.conflicts.length,
        completedNodes: Object.keys(result.rawResults).length,
      },
    } satisfies OrchestratorEvent);

    return result.summary;
  }

  // ── Runtime Intervention ─────────────────────────────────────────────────

  /**
   * Cancel a specific task node.
   */
  cancelTask(graphId: string, nodeId: string): boolean {
    const graph = this.activeGraphs.get(graphId);
    if (!graph) return false;

    const helper = new TaskGraphHelper(graph);
    const node = helper.getNode(nodeId);
    if (!node) return false;

    if (node.status === 'running') {
      this.runtime.stopSession(`orchestrator-${nodeId}`);
    }

    helper.updateNodeStatus(nodeId, 'cancelled', { error: 'Cancelled by user' });

    this.emit('orchestrator:event', {
      type: 'execute:node-cancelled',
      graphId,
      nodeId,
      timestamp: new Date().toISOString(),
    } satisfies OrchestratorEvent);

    return true;
  }

  /**
   * Retry a failed task node.
   */
  retryTask(graphId: string, nodeId: string): boolean {
    const graph = this.activeGraphs.get(graphId);
    if (!graph) return false;

    const helper = new TaskGraphHelper(graph);
    const node = helper.getNode(nodeId);
    if (!node) return false;

    if (node.status !== 'failed') return false;

    // Reset the node to pending so the scheduler will pick it up
    helper.updateNodeStatus(nodeId, 'pending');
    delete node.error;

    this.emit('orchestrator:event', {
      type: 'execute:node-start',
      graphId,
      nodeId,
      timestamp: new Date().toISOString(),
      payload: { retry: true },
    } satisfies OrchestratorEvent);

    return true;
  }

  /**
   * Inject additional context into a pending task node's prompt.
   */
  injectContext(graphId: string, nodeId: string, context: string): boolean {
    const graph = this.activeGraphs.get(graphId);
    if (!graph) return false;

    const helper = new TaskGraphHelper(graph);
    const node = helper.getNode(nodeId);
    if (!node) return false;

    if (node.status !== 'pending') return false;

    node.prompt += `\n\n[Additional Context]\n${context}`;
    return true;
  }

  /**
   * Cancel all running tasks (emergency stop).
   */
  emergencyStop(): void {
    this.scheduler.cancel();
    this.activeGraphs.clear();
  }

  /**
   * Get the current status of a graph.
   */
  getGraphStatus(graphId: string): TaskGraph | undefined {
    return this.activeGraphs.get(graphId);
  }

  /**
   * Get the AgentPool instance for external registration.
   */
  getAgentPool(): AgentPool {
    return this.agentPool;
  }
}
