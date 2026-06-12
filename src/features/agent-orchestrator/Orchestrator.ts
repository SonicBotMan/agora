/**
 * Orchestrator — core agent orchestrator.
 *
 * Plans a goal into a TaskGraph, executes nodes via the TaskScheduler,
 * aggregates results, and provides runtime intervention methods.
 */

import { EventEmitter } from 'events';

import { CoworkAgentEngine } from '../../shared/cowork/constants';
import { AgentPool } from './AgentPool';
import { TaskGraphHelper } from './TaskGraph';
import { TaskResultAggregator } from './TaskResultAggregator';
import { TaskScheduler } from './TaskScheduler';
import { builtInTemplates } from './templates/index';
import type {
  AggregateResult,
  CoworkRuntime,
  OrchestratorEvent,
  TaskGraph,
  TaskNode,
  WorkflowTemplate,
} from './types';

export interface OrchestratorOptions {
  runtime: CoworkRuntime;
  agentPool?: AgentPool;
  maxConcurrency?: number;
  defaultTimeout?: number;
}

type TemplateResolution =
  | { template: WorkflowTemplate; source: 'template' | 'auto' }
  | null;

type WorkflowKeywordRule = {
  templateId: string;
  keywords: string[];
};

const workflowKeywordRules: WorkflowKeywordRule[] = [
  {
    templateId: 'project-dev',
    keywords: [
      'build',
      'bug',
      'code',
      'coding',
      'develop',
      'development',
      'engineer',
      'feature',
      'fix',
      'frontend',
      'backend',
      'implement',
      'implementation',
      'refactor',
      'release',
      'ship',
      'test',
      '开发',
      '编码',
      '实现',
      '重构',
      '修复',
      '前端',
      '后端',
      '测试',
      '发布',
      '交付',
    ],
  },
  {
    templateId: 'deep-investigation',
    keywords: [
      'analysis',
      'analyze',
      'evidence',
      'investigate',
      'investigation',
      'research',
      'report',
      'trend',
      'study',
      '调研',
      '研究',
      '分析',
      '报告',
      '证据',
      '趋势',
      '课题',
      '论文',
      '热点',
    ],
  },
  {
    templateId: 'plan-design',
    keywords: [
      'brief',
      'design',
      'plan',
      'planning',
      'proposal',
      'roadmap',
      'strategy',
      'workshop',
      '策划',
      '方案',
      '规划',
      '设计',
      '路线图',
      '战略',
      '提案',
      '计划',
    ],
  },
];

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
   */
  async plan(goal: string, context?: string, templateId?: string): Promise<TaskGraph> {
    this.emit('orchestrator:event', {
      type: 'plan:start',
      graphId: '',
      timestamp: new Date().toISOString(),
      payload: { goal, templateId },
    } satisfies OrchestratorEvent);

    let graph: TaskGraph;
    const resolvedTemplate = this.resolveTemplate(goal, context, templateId);

    if (resolvedTemplate) {
      graph = this.createGraphFromTemplate(
        resolvedTemplate.template,
        goal,
        context,
        resolvedTemplate.source,
      );
    } else {
      graph = this.createAutoGraph(goal, context);
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

    if (node.status !== 'pending' && node.status !== 'running') {
      return false;
    }

    if (node.status === 'running') {
      this.scheduler.cancelNode(graphId, nodeId);
    }

    helper.updateNodeStatus(nodeId, 'cancelled', { error: 'Cancelled by user' });
    graph.status = helper.computeOverallStatus();

    this.emit('orchestrator:event', {
      type: 'execute:node-cancelled',
      graphId,
      nodeId,
      timestamp: new Date().toISOString(),
    } satisfies OrchestratorEvent);

    return true;
  }

  /**
   * Cancel all pending/running tasks in a graph.
   */
  cancelGraph(graphId: string): boolean {
    const graph = this.activeGraphs.get(graphId);
    if (!graph) return false;

    let cancelledAny = false;
    for (const node of graph.nodes) {
      if (this.cancelTask(graphId, node.id)) {
        cancelledAny = true;
      }
    }

    const updatedGraph = this.activeGraphs.get(graphId);
    if (updatedGraph) {
      updatedGraph.status = new TaskGraphHelper(updatedGraph).computeOverallStatus();
    }

    return cancelledAny;
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

  private resolveTemplate(
    goal: string,
    context?: string,
    templateId?: string,
  ): TemplateResolution {
    if (templateId) {
      const explicitTemplate = this.templates.get(templateId);
      if (!explicitTemplate) {
        throw new Error(`Orchestrator template not found: ${templateId}`);
      }
      return {
        template: explicitTemplate,
        source: 'template',
      };
    }

    const inferredTemplateId = this.inferTemplateId(goal, context);
    if (!inferredTemplateId) {
      return null;
    }

    const inferredTemplate = this.templates.get(inferredTemplateId);
    if (!inferredTemplate) {
      return null;
    }

    return {
      template: inferredTemplate,
      source: 'auto',
    };
  }

  private inferTemplateId(goal: string, context?: string): string | null {
    const combinedText = `${goal}\n${context ?? ''}`.toLowerCase();
    let bestRule: WorkflowKeywordRule | null = null;
    let bestScore = 0;

    for (const rule of workflowKeywordRules) {
      const score = rule.keywords.reduce((count, keyword) => (
        combinedText.includes(keyword.toLowerCase()) ? count + 1 : count
      ), 0);

      if (score > bestScore) {
        bestRule = rule;
        bestScore = score;
      }
    }

    if (!bestRule || bestScore === 0) {
      return null;
    }

    return bestRule.templateId;
  }

  private createGraphFromTemplate(
    template: WorkflowTemplate,
    goal: string,
    context: string | undefined,
    source: 'template' | 'auto',
  ): TaskGraph {
    const graph = template.createGraph(goal, context);
    const normalizedContext = context?.trim();
    const nodes = !normalizedContext
      ? graph.nodes
      : graph.nodes.map((node) => ({
          ...node,
          prompt: node.prompt.includes(normalizedContext)
            ? node.prompt
            : `${node.prompt}\n\n[Shared Context]\n${normalizedContext}`,
        }));

    return {
      ...graph,
      description: source === 'auto'
        ? `Auto-selected ${template.name} workflow for: ${goal.substring(0, 120)}`
        : graph.description,
      nodes,
      source,
    };
  }

  private createAutoGraph(goal: string, context?: string): TaskGraph {
    const now = new Date().toISOString();
    const contextSection = context?.trim()
      ? `\n\n补充上下文与约束：\n${context.trim()}`
      : '';
    const nodes: TaskNode[] = [
      {
        id: 'clarify-objective',
        agentEngine: CoworkAgentEngine.Hermes,
        prompt: [
          '梳理目标范围、关键约束、成功标准和主要风险。',
          '输出内容需要能直接作为后续执行的统一背景。',
          '',
          `目标：${goal}`,
          contextSection,
        ].join('\n'),
        dependsOn: [],
        timeout: 120_000,
        retry: 0,
        status: 'pending',
      },
      {
        id: 'identify-workstreams',
        agentEngine: CoworkAgentEngine.OpenCode,
        prompt: [
          '基于目标澄清结果，拆分核心工作流、依赖关系和阶段性交付物。',
          '每条工作流都要说明目标、输入、输出和主要阻塞项。',
        ].join('\n'),
        dependsOn: ['clarify-objective'],
        timeout: 120_000,
        retry: 0,
        status: 'pending',
      },
      {
        id: 'implementation-plan',
        agentEngine: CoworkAgentEngine.ClaudeCode,
        prompt: [
          '为每条工作流制定可执行实施方案。',
          '明确实现顺序、模块边界、接口约束和需要落地的产出物。',
        ].join('\n'),
        dependsOn: ['identify-workstreams'],
        timeout: 180_000,
        retry: 1,
        status: 'pending',
      },
      {
        id: 'verification-plan',
        agentEngine: CoworkAgentEngine.Codex,
        prompt: [
          '设计验证与测试方案。',
          '覆盖功能正确性、边界条件、回归风险和最终交付检查项。',
        ].join('\n'),
        dependsOn: ['identify-workstreams'],
        timeout: 180_000,
        retry: 1,
        status: 'pending',
      },
      {
        id: 'final-delivery-brief',
        agentEngine: CoworkAgentEngine.Hermes,
        prompt: [
          '综合实施方案与验证方案，输出最终交付计划。',
          '需要包含优先级、里程碑、风险缓解、依赖协调和验收标准。',
        ].join('\n'),
        dependsOn: ['implementation-plan', 'verification-plan'],
        timeout: 120_000,
        retry: 0,
        status: 'pending',
      },
    ];

    return {
      id: `auto-plan-${Date.now()}`,
      name: 'Structured Delivery Plan',
      description: `Auto-generated execution workflow for: ${goal.substring(0, 120)}`,
      nodes,
      source: context?.trim() ? 'manual' : 'auto',
      createdAt: now,
      status: 'pending',
    };
  }
}
