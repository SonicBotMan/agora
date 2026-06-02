/**
 * TaskResultAggregator — collects results from completed nodes,
 * detects conflicts between overlapping results, and produces a summary.
 */

import type { TaskGraph, TaskNode, ConflictInfo, AggregateResult } from './types';
import { TaskGraphHelper } from './TaskGraph';

export class TaskResultAggregator {
  /**
   * Aggregate all completed node results into a single summary string.
   * Also detects conflicts between nodes that share dependencies.
   */
  aggregate(graph: TaskGraph): AggregateResult {
    const helper = new TaskGraphHelper(graph);
    const completedNodes = helper.getFinishedNodes().filter(n => n.status === 'completed');

    const rawResults: Record<string, string> = {};
    for (const node of completedNodes) {
      if (node.result) {
        rawResults[node.id] = node.result;
      }
    }

    const conflicts = this.detectConflicts(completedNodes);

    const summary = this.buildSummary(completedNodes, conflicts);

    return { summary, conflicts, rawResults };
  }

  /**
   * Detect potential conflicts between node results.
   * A conflict is flagged when two nodes that have overlapping dependency
   * chains produce results that may contradict each other.
   */
  detectConflicts(nodes: TaskNode[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Simple heuristic: if two completed nodes share a common dependency
    // but have no dependency relationship between themselves, flag as
    // potential conflict area.
    const completed = nodes.filter(n => n.status === 'completed');

    for (let i = 0; i < completed.length; i++) {
      for (let j = i + 1; j < completed.length; j++) {
        const a = completed[i];
        const b = completed[j];

        // Skip if one depends on the other (they're already in sequence)
        if (a.dependsOn.includes(b.id) || b.dependsOn.includes(a.id)) continue;

        // Check for shared dependencies
        const sharedDeps = a.dependsOn.filter(dep => b.dependsOn.includes(dep));
        if (sharedDeps.length > 0 && a.result && b.result) {
          conflicts.push({
            nodeIds: [a.id, b.id],
            description: `Nodes "${a.id}" and "${b.id}" share dependencies [${sharedDeps.join(', ')}] but are not ordered relative to each other. Results may contain overlapping or contradictory information.`,
            severity: 'info',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Build a human-readable summary from completed node results.
   */
  private buildSummary(nodes: TaskNode[], conflicts: ConflictInfo[]): string {
    if (nodes.length === 0) return 'No tasks completed.';

    const parts: string[] = [];
    parts.push(`## Aggregated Results (${nodes.length} tasks)\n`);

    for (const node of nodes) {
      if (node.result) {
        parts.push(`### Task: ${node.id}\n`);
        parts.push(node.result.trim());
        parts.push('');
      }
    }

    if (conflicts.length > 0) {
      parts.push('---');
      parts.push(`**${conflicts.length} potential conflict(s) detected:**\n`);
      for (const c of conflicts) {
        parts.push(`- [${c.severity}] ${c.description}`);
      }
    }

    return parts.join('\n');
  }
}
