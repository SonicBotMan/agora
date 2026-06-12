/**
 * TaskScheduler — executes tasks with configurable parallelism,
 * timeout handling, and retry logic.
 */

import { EventEmitter } from 'events';

import type { AgentPool } from './AgentPool';
import { TaskGraphHelper } from './TaskGraph';
import type { CoworkRuntime,OrchestratorEvent, TaskGraph, TaskNode } from './types';

export interface SchedulerOptions {
  /** Maximum number of tasks to run concurrently. 0 = unlimited. */
  maxConcurrency?: number;
  /** Default timeout in ms per task (overridden by node.timeout). */
  defaultTimeout?: number;
  /** Default retry count (overridden by node.retry). */
  defaultRetry?: number;
}

class TaskCancelledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskCancelledError';
  }
}

export class TaskScheduler extends EventEmitter {
  private runtime: CoworkRuntime;
  private agentPool: AgentPool;
  private options: Required<SchedulerOptions>;
  private abortController: AbortController | null = null;
  private readonly activeNodeSessions = new Map<string, string>();

  constructor(
    runtime: CoworkRuntime,
    agentPool: AgentPool,
    options: SchedulerOptions = {},
  ) {
    super();
    this.runtime = runtime;
    this.agentPool = agentPool;
    void this.agentPool;
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
        && helper.getNode(id)?.status === 'pending'
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

  cancelNode(graphId: string, nodeId: string): boolean {
    const sessionId = this.activeNodeSessions.get(this.buildNodeRunKey(graphId, nodeId));
    if (!sessionId) {
      return false;
    }
    this.runtime.stopSession(sessionId);
    return true;
  }

  /** Check if a node is currently running (in-flight). */
  private isInFlight(_nodeId: string, _inFlight: Set<Promise<void>>): boolean {
    // We track in-flight nodes via a separate set passed in execute()
    return false; // handled by caller's `inFlight` set
  }

  private buildNodeRunKey(graphId: string, nodeId: string): string {
    return `${graphId}:${nodeId}`;
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
        const result = await this.runTaskWithTimeout(
          helper.getData().id,
          node,
          timeoutMs,
          signal,
        );
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

        if (err instanceof TaskCancelledError) {
          helper.updateNodeStatus(nodeId, 'cancelled', { error: errorMessage });
          this.emit('orchestrator:event', {
            type: 'execute:node-cancelled',
            graphId: helper.getData().id,
            nodeId,
            timestamp: new Date().toISOString(),
            payload: { error: errorMessage },
          } satisfies OrchestratorEvent);
          return;
        }

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
   * Run a single task node against the shared CoworkRuntime with a timeout guard.
   */
  private async runTaskWithTimeout(
    graphId: string,
    node: TaskNode,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<string> {
    const sessionId = `orchestrator-${node.id}-${Date.now()}`;
    const activeKey = this.buildNodeRunKey(graphId, node.id);

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const assistantMessages = new Map<string, string>();
      const assistantMessageOrder: string[] = [];

      const cleanup = (): void => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
        this.runtime.off('message', onMessage);
        this.runtime.off('messageUpdate', onMessageUpdate);
        this.runtime.off('complete', onComplete);
        this.runtime.off('error', onError);
        this.runtime.off('sessionStopped', onSessionStopped);
        this.activeNodeSessions.delete(activeKey);
      };

      const settle = (
        callback: (value: string) => void,
        value: string,
      ): void => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };

      const settleError = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const buildResult = (): string => {
        const combined = assistantMessageOrder
          .map((messageId) => assistantMessages.get(messageId)?.trim() ?? '')
          .filter(Boolean)
          .join('\n\n')
          .trim();
        return combined || `Task "${node.id}" completed without assistant output.`;
      };

      const timeout = setTimeout(() => {
        this.runtime.stopSession(sessionId);
        settleError(
          new Error(`Task "${node.id}" timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      const upsertAssistantMessage = (
        messageId: string,
        content: string,
      ): void => {
        if (!assistantMessages.has(messageId)) {
          assistantMessageOrder.push(messageId);
        }
        assistantMessages.set(messageId, content);
      };

      const onMessage = (
        activeSessionId: string,
        message: { id: string; type: string; content: string },
      ): void => {
        if (activeSessionId !== sessionId || message.type !== 'assistant') return;
        upsertAssistantMessage(message.id, message.content);
      };

      const onMessageUpdate = (
        activeSessionId: string,
        messageId: string,
        content: string,
      ): void => {
        if (activeSessionId !== sessionId) return;
        upsertAssistantMessage(messageId, content);
      };

      const onComplete = (activeSessionId: string): void => {
        if (activeSessionId !== sessionId) return;
        settle(resolve, buildResult());
      };

      const onError = (activeSessionId: string, error: string): void => {
        if (activeSessionId !== sessionId) return;
        settleError(new Error(error));
      };

      const onAbort = (): void => {
        this.runtime.stopSession(sessionId);
        settleError(new TaskCancelledError(`Task "${node.id}" was cancelled`));
      };

      const onSessionStopped = (activeSessionId: string): void => {
        if (activeSessionId !== sessionId) return;
        settleError(new TaskCancelledError(`Task "${node.id}" was cancelled`));
      };

      signal.addEventListener('abort', onAbort, { once: true });
      this.runtime.on('message', onMessage);
      this.runtime.on('messageUpdate', onMessageUpdate);
      this.runtime.on('complete', onComplete);
      this.runtime.on('error', onError);
      this.runtime.on('sessionStopped', onSessionStopped);
      this.activeNodeSessions.set(activeKey, sessionId);

      void this.runtime.startSession(sessionId, node.prompt, {
        agentEngine: node.agentEngine,
        agentId: node.agentId,
      }).catch((error) => {
        const normalizedError = error instanceof Error
          ? error
          : new Error(String(error));
        settleError(normalizedError);
      });
    });
  }
}
