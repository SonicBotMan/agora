/**
 * TaskScheduler — executes tasks with configurable parallelism,
 * timeout handling, and retry logic.
 */

import { EventEmitter } from 'events';

import type { TaskGraph, TaskNode, OrchestratorEvent, CoworkRuntime } from './types';
import { TaskGraphHelper } from './TaskGraph';
import type { AgentPool } from './AgentPool';

export interface SchedulerOptions {
  /** Maximum number of tasks to run concurrently. 0 = unlimited. */
  maxConcurrency?: number;
  /** Default timeout in ms per task (overridden by node.timeout). */
  defaultTimeout?: number;
  /** Default retry count (overridden by node.retry). */
  defaultRetry?: number;
}

export class TaskScheduler extends EventEmitter {
  private runtime: CoworkRuntime;
  private agentPool: AgentPool;
  private options: Required<SchedulerOptions>;
  private abortController: AbortController | null = null;

  constructor(
    runtime: CoworkRuntime,
    agentPool: AgentPool,
    options: SchedulerOptions = {},
  ) {
    super();
    this.runtime = runtime;
    this.agentPool = agentPool;
    this.options = {
      maxConcurrency: options.maxConcurrency ?? 3,
      defaultTimeout: options.defaultTimeout ?? 120_000,
      defaultRetry: options.defaultRetry ?? 0,
    };
  }

  /**
   * Execute all nodes in a TaskGraph.
   * Nodes are scheduled according to topological order —
   * dependencies must complete before dependents start.
   * Independent nodes run in parallel (up to maxConcurrency).
   */
  async execute(graph: TaskGraph): Promise<TaskGraph> {
    const helper = new TaskGraphHelper(graph);
    this.abortController = new AbortController();

    const validationErrors = helper.validateDependencies();
    if (validationErrors.length > 0) {
      throw new Error(`Graph validation failed:\n${validationErrors.join('\n')}`);
    }

    if (helper.hasCycle()) {
      throw new Error('Graph contains a cycle and cannot be executed');
    }

    const topoOrder = helper.topologicalSort();
    const signal = this.abortController.signal;

    // Update graph status
    graph.status = 'running';

    // Execute in topological order, grouping ready nodes for parallelism
    const executed = new Set<string>();
    const inFlight = new Set<Promise<void>>();
    const queue: string[] = [...topoOrder];

    while (queue.length > 0 && !signal.aborted) {
      // Find all nodes whose dependencies are satisfied
      const ready = queue.filter(id =>
        !executed.has(id)
        && helper.dependenciesSatisfied(id)
        && !this.isInFlight(id, inFlight),
      );

      if (ready.length === 0 && inFlight.size === 0) {
        // No ready nodes and nothing in flight — either done or stuck
        break;
      }

      // Throttle to maxConcurrency
      const batch = ready.slice(0, this.options.maxConcurrency - inFlight.size);

      for (const nodeId of batch) {
        executed.add(nodeId);
        const promise = this.executeNode(helper, nodeId, signal);
        inFlight.add(promise);

        // Remove from inFlight when done
        promise.finally(() => {
          inFlight.delete(promise);
        });
      }

      // Wait for at least one in-flight task to complete before re-checking
      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      } else {
        break;
      }
    }

    // Wait for all remaining tasks
    if (inFlight.size > 0) {
      await Promise.all(inFlight);
    }

    // Update overall status
    graph.status = helper.computeOverallStatus();

    this.emit('orchestrator:event', {
      type: graph.status === 'completed' ? 'execute:complete' : 'execute:failed',
      graphId: graph.id,
      timestamp: new Date().toISOString(),
    } satisfies OrchestratorEvent);

    return graph;
  }

  /** Cancel all running tasks. */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /** Check if a node is currently running (in-flight). */
  private isInFlight(nodeId: string, inFlight: Set<Promise<void>>): boolean {
    // We track in-flight nodes via a separate set passed in execute()
    return false; // handled by caller's `inFlight` set
  }

  /**
   * Execute a single node with timeout and retry logic.
   */
  private async executeNode(
    helper: TaskGraphHelper,
    nodeId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const node = helper.getNode(nodeId);
    if (!node) throw new Error(`Node "${nodeId}" not found`);

    const maxRetries = node.retry ?? this.options.defaultRetry;
    const timeoutMs = node.timeout ?? this.options.defaultTimeout;

    helper.updateNodeStatus(nodeId, 'running');

    this.emit('orchestrator:event', {
      type: 'execute:node-start',
      graphId: helper.getData().id,
      nodeId,
      timestamp: new Date().toISOString(),
    } satisfies OrchestratorEvent);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) {
        helper.updateNodeStatus(nodeId, 'cancelled', { error: 'Execution cancelled' });
        this.emit('orchestrator:event', {
          type: 'execute:node-cancelled',
          graphId: helper.getData().id,
          nodeId,
          timestamp: new Date().toISOString(),
        } satisfies OrchestratorEvent);
        return;
      }

      try {
        const result = await this.runTaskWithTimeout(node, timeoutMs, signal);
        helper.updateNodeStatus(nodeId, 'completed', { result });
        this.emit('orchestrator:event', {
          type: 'execute:node-complete',
          graphId: helper.getData().id,
          nodeId,
          timestamp: new Date().toISOString(),
          payload: { result },
        } satisfies OrchestratorEvent);
        return;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (attempt < maxRetries) {
          this.emit('orchestrator:event', {
            type: 'execute:node-retrying',
            graphId: helper.getData().id,
            nodeId,
            timestamp: new Date().toISOString(),
            payload: { attempt: attempt + 1, maxRetries, error: errorMessage },
          } satisfies OrchestratorEvent);
          continue;
        }

        helper.updateNodeStatus(nodeId, 'failed', { error: errorMessage });
        this.emit('orchestrator:event', {
          type: 'execute:node-failed',
          graphId: helper.getData().id,
          nodeId,
          timestamp: new Date().toISOString(),
          payload: { error: errorMessage },
        } satisfies OrchestratorEvent);
      }
    }
  }

  /**
   * Run a single task node with a timeout guard.
   * TODO: Replace placeholder with actual CoworkRuntime.startSession() call.
   */
  private async runTaskWithTimeout(
    node: TaskNode,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<string> {
    const sessionId = `orchestrator-${node.id}-${Date.now()}`;

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.runtime.stopSession(sessionId);
        reject(new Error(`Task "${node.id}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onAbort = (): void => {
        clearTimeout(timeout);
        this.runtime.stopSession(sessionId);
        reject(new Error(`Task "${node.id}" was cancelled`));
      };

      signal.addEventListener('abort', onAbort, { once: true });

      // TODO: Replace placeholder with actual LLM dispatch via runtime
      // this.runtime.startSession(sessionId, node.prompt, {
      //   agentEngine: node.agentEngine,
      //   agentId: node.agentId,
      // });

      // Placeholder: simulate async execution
      Promise.resolve().then(() => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
        resolve(`[Placeholder result for "${node.id}"] ${node.prompt.substring(0, 60)}...`);
      }).catch(reject);
    });
  }
}
