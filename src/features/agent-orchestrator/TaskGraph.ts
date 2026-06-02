/**
 * TaskGraph utility class.
 * Provides topological sorting, dependency checking, cycle detection,
 * and executable-node retrieval for TaskGraph data.
 */

import type { TaskGraph, TaskNode, TaskNodeStatus } from './types';

export class TaskGraphHelper {
  private graph: TaskGraph;

  constructor(graph: TaskGraph) {
    this.graph = graph;
  }

  /** Return the underlying graph data. */
  getData(): TaskGraph {
    return this.graph;
  }

  /** Update the graph reference (e.g. after execution). */
  setData(graph: TaskGraph): void {
    this.graph = graph;
  }

  /** Find a node by id. */
  getNode(id: string): TaskNode | undefined {
    return this.graph.nodes.find(n => n.id === id);
  }

  /** Return all nodes. */
  getNodes(): TaskNode[] {
    return this.graph.nodes;
  }

  // ── Topological Sort ────────────────────────────────────────────────────

  /**
   * Perform a topological sort of the graph's nodes.
   * Returns an ordered array of node IDs.
   * Throws if a cycle is detected.
   */
  topologicalSort(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const order: string[] = [];

    const dfs = (nodeId: string): void => {
      if (recursionStack.has(nodeId)) {
        throw new Error(`Cycle detected: node "${nodeId}" appears twice in the dependency chain`);
      }
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.getNode(nodeId);
      if (node) {
        for (const dep of node.dependsOn) {
          dfs(dep);
        }
      }

      recursionStack.delete(nodeId);
      order.unshift(nodeId); // prepend for topological order
    };

    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return order;
  }

  // ── Cycle Detection ─────────────────────────────────────────────────────

  /** Returns true if the graph contains at least one cycle. */
  hasCycle(): boolean {
    try {
      this.topologicalSort();
      return false;
    } catch {
      return true;
    }
  }

  /** Returns the list of node IDs that form a cycle, or empty array. */
  detectCycle(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): string[] | null => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle — extract from the current path
        const cycleStart = path.indexOf(nodeId);
        return path.slice(cycleStart).concat(nodeId);
      }
      if (visited.has(nodeId)) return null;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = this.getNode(nodeId);
      if (node) {
        for (const dep of node.dependsOn) {
          const result = dfs(dep);
          if (result) return result;
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return null;
    };

    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        const cycle = dfs(node.id);
        if (cycle) return cycle;
      }
    }

    return [];
  }

  // ── Dependency Checks ───────────────────────────────────────────────────

  /** Check if all dependencies of a node are satisfied (status === 'completed'). */
  dependenciesSatisfied(nodeId: string): boolean {
    const node = this.getNode(nodeId);
    if (!node) return false;
    return node.dependsOn.every(depId => {
      const dep = this.getNode(depId);
      return dep?.status === 'completed';
    });
  }

  /** Return the list of dependency IDs that have NOT yet completed. */
  getUnsatisfiedDependencies(nodeId: string): string[] {
    const node = this.getNode(nodeId);
    if (!node) return [];
    return node.dependsOn.filter(depId => {
      const dep = this.getNode(depId);
      return dep?.status !== 'completed';
    });
  }

  /** Verify that every node's dependsOn references exist in the graph. */
  validateDependencies(): string[] {
    const allIds = new Set(this.graph.nodes.map(n => n.id));
    const missing: string[] = [];
    for (const node of this.graph.nodes) {
      for (const dep of node.dependsOn) {
        if (!allIds.has(dep)) {
          missing.push(`Node "${node.id}" depends on missing node "${dep}"`);
        }
      }
    }
    return missing;
  }

  // ── Executable Nodes ────────────────────────────────────────────────────

  /**
   * Return all nodes that are ready to execute:
   * - status is 'pending' (not yet started, failed, or completed)
   * - all dependencies have status === 'completed'
   */
  getExecutableNodes(): TaskNode[] {
    return this.graph.nodes.filter(node =>
      node.status === 'pending'
      && this.dependenciesSatisfied(node.id),
    );
  }

  /** Return all nodes that are still pending (not yet eligible or waiting). */
  getPendingNodes(): TaskNode[] {
    return this.graph.nodes.filter(n => n.status === 'pending');
  }

  /** Return all nodes that have finished (completed or failed). */
  getFinishedNodes(): TaskNode[] {
    return this.graph.nodes.filter(n =>
      n.status === 'completed' || n.status === 'failed',
    );
  }

  /** Update the status of a single node in-place. */
  updateNodeStatus(nodeId: string, status: TaskNodeStatus, resultOrError?: { result?: string; error?: string }): void {
    const node = this.getNode(nodeId);
    if (!node) throw new Error(`Node "${nodeId}" not found`);
    node.status = status;
    if (resultOrError?.result !== undefined) node.result = resultOrError.result;
    if (resultOrError?.error !== undefined) node.error = resultOrError.error;
  }

  /** Compute an overall graph status from node statuses. */
  computeOverallStatus(): TaskGraph['status'] {
    const nodes = this.graph.nodes;
    if (nodes.length === 0) return 'pending';

    const allCompleted = nodes.every(n => n.status === 'completed');
    if (allCompleted) return 'completed';

    const anyFailed = nodes.some(n => n.status === 'failed' || n.status === 'cancelled');
    const anyRunning = nodes.some(n => n.status === 'running');
    const anyPending = nodes.some(n => n.status === 'pending');

    if (anyRunning) return 'running';
    if (anyPending && !anyFailed) return 'running';
    if (anyFailed) return 'failed';
    return 'pending';
  }
}
