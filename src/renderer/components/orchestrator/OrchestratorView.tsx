import {
  ArrowPathIcon,
  PlayIcon,
  QueueListIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  OrchestratorEvent,
  TaskGraph,
  TaskNode,
  WorkflowTemplate,
} from '../../../features/agent-orchestrator';
import { i18nService } from '../../services/i18n';
import { orchestratorService } from '../../services/orchestrator';
import ComposeIcon from '../icons/ComposeIcon';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ThemedSelect from '../ui/ThemedSelect';
import WindowTitleBar from '../window/WindowTitleBar';

interface OrchestratorViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

const showToast = (message: string): void => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const formatTimestamp = (value?: string): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getGraphStatusLabel = (status: TaskGraph['status']): string => {
  switch (status) {
    case 'running':
      return i18nService.t('orchestratorStatusRunning');
    case 'completed':
      return i18nService.t('orchestratorStatusCompleted');
    case 'failed':
      return i18nService.t('orchestratorStatusFailed');
    default:
      return i18nService.t('orchestratorStatusPending');
  }
};

const getNodeStatusLabel = (status: TaskNode['status']): string => {
  switch (status) {
    case 'running':
      return i18nService.t('orchestratorNodeRunning');
    case 'completed':
      return i18nService.t('orchestratorNodeCompleted');
    case 'failed':
      return i18nService.t('orchestratorNodeFailed');
    case 'cancelled':
      return i18nService.t('orchestratorNodeCancelled');
    case 'skipped':
      return i18nService.t('orchestratorNodeSkipped');
    default:
      return i18nService.t('orchestratorNodePending');
  }
};

const upsertGraphList = (graphs: TaskGraph[], graph: TaskGraph): TaskGraph[] => {
  const merged = graphs.filter((current) => current.id !== graph.id);
  merged.push(graph);
  return merged.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const OrchestratorView: React.FC<OrchestratorViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  updateBadge,
}) => {
  const isMac = window.electron.platform === 'darwin';
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [graphs, setGraphs] = useState<TaskGraph[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [context, setContext] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionGraphId, setActionGraphId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const selectedGraph = useMemo(
    () => graphs.find((graph) => graph.id === selectedGraphId) ?? null,
    [graphs, selectedGraphId],
  );
  const templateOptions = [
    { value: '', label: i18nService.t('orchestratorTemplateAuto') },
    ...templates.map((template) => ({
      value: template.id,
      label: template.name,
    })),
  ];

  const loadTemplates = useCallback(async () => {
    setTemplates(await orchestratorService.listTemplates());
  }, []);

  const refreshGraph = useCallback(async (graphId: string) => {
    const graph = await orchestratorService.getStatus(graphId);
    if (graph) {
      setGraphs((current) => upsertGraphList(current, graph));
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setInlineError(null);

      try {
        await loadTemplates();
      } catch (error) {
        console.error('Failed to load orchestrator templates:', error);
        setInlineError(i18nService.t('orchestratorLoadFailed'));
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, [loadTemplates]);

  useEffect(() => {
    const dispose = orchestratorService.onEvent((event: OrchestratorEvent) => {
      if (!event.graphId) {
        return;
      }

      if (event.type === 'execute:complete') {
        showToast(i18nService.t('orchestratorExecuteCompletedToast'));
      } else if (event.type === 'execute:failed' || event.type === 'error') {
        showToast(i18nService.t('orchestratorExecuteFailedToast'));
      }

      void refreshGraph(event.graphId);
    });

    return dispose;
  }, [refreshGraph]);

  const handlePlan = useCallback(async () => {
    if (!goal.trim()) {
      showToast(i18nService.t('orchestratorEnterGoal'));
      return;
    }

    setIsPlanning(true);
    setInlineError(null);

    try {
      const graph = await orchestratorService.plan(
        goal.trim(),
        context.trim() || undefined,
        selectedTemplateId || undefined,
      );

      if (!graph) {
        showToast(i18nService.t('orchestratorPlanFailed'));
        return;
      }

      setGraphs((current) => upsertGraphList(current, graph));
      setSelectedGraphId(graph.id);
      setSummary('');
    } catch (error) {
      console.error('Failed to plan orchestrator graph:', error);
      showToast(i18nService.t('orchestratorPlanFailed'));
    } finally {
      setIsPlanning(false);
    }
  }, [context, goal, selectedTemplateId]);

  const handleExecute = useCallback(async () => {
    if (!selectedGraph) {
      showToast(i18nService.t('orchestratorSelectGraph'));
      return;
    }

    setIsExecuting(true);
    setActionGraphId(selectedGraph.id);

    try {
      const result = await orchestratorService.execute(selectedGraph.id);
      if (!result?.graph) {
        showToast(i18nService.t('orchestratorExecuteFailed'));
        return;
      }

      setGraphs((current) => upsertGraphList(current, result.graph!));
      setSelectedGraphId(result.graph.id);
      setSummary(result.summary);
    } catch (error) {
      console.error('Failed to execute orchestrator graph:', error);
      showToast(i18nService.t('orchestratorExecuteFailed'));
    } finally {
      setIsExecuting(false);
      setActionGraphId(null);
    }
  }, [selectedGraph]);

  const handleCancel = useCallback(async () => {
    if (!selectedGraph) {
      return;
    }

    setActionGraphId(selectedGraph.id);

    try {
      const cancelled = await orchestratorService.cancel(selectedGraph.id);
      if (!cancelled) {
        showToast(i18nService.t('orchestratorCancelFailed'));
        return;
      }

      showToast(i18nService.t('orchestratorCancelledToast'));
      await refreshGraph(selectedGraph.id);
    } catch (error) {
      console.error('Failed to cancel orchestrator graph:', error);
      showToast(i18nService.t('orchestratorCancelFailed'));
    } finally {
      setActionGraphId(null);
    }
  }, [refreshGraph, selectedGraph]);

  const handleRefresh = useCallback(async () => {
    await loadTemplates();
    if (selectedGraphId) {
      await refreshGraph(selectedGraphId);
    }
  }, [loadTemplates, refreshGraph, selectedGraphId]);

  const completedNodes = selectedGraph?.nodes.filter((node) => node.status === 'completed').length ?? 0;
  const failedNodes = selectedGraph?.nodes.filter((node) => node.status === 'failed').length ?? 0;

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="draggable flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
        <div className="flex h-8 items-center space-x-3">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
              {updateBadge}
            </div>
          )}
          <h1 className="text-lg font-semibold text-foreground">
            {i18nService.t('orchestratorTitle')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-y-auto border-r border-border bg-surface/60 p-4 [scrollbar-gutter:stable]">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('orchestratorPlanTitle')}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {i18nService.t('orchestratorDescription')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-secondary">
                  {i18nService.t('orchestratorGoalLabel')}
                </div>
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder={i18nService.t('orchestratorGoalPlaceholder')}
                  className="min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-secondary">
                  {i18nService.t('orchestratorContextLabel')}
                </div>
                <textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder={i18nService.t('orchestratorContextPlaceholder')}
                  className="min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <ThemedSelect
                id="orchestrator-template"
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                options={templateOptions}
                label={i18nService.t('orchestratorTemplateLabel')}
              />

              <button
                type="button"
                onClick={() => void handlePlan()}
                disabled={isPlanning}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <QueueListIcon className="h-4 w-4" />
                {isPlanning ? i18nService.t('loading') : i18nService.t('orchestratorPlanAction')}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('orchestratorGraphsTitle')}
              </h2>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {i18nService.t('orchestratorRefresh')}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="rounded-lg border border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('loading')}
                </div>
              ) : graphs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('orchestratorNoGraphs')}
                </div>
              ) : (
                graphs.map((graph) => {
                  const isSelected = graph.id === selectedGraphId;
                  return (
                    <button
                      key={graph.id}
                      type="button"
                      onClick={() => setSelectedGraphId(graph.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-background hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {graph.name}
                          </div>
                          <div className="mt-1 truncate text-xs text-secondary">
                            {graph.nodes.length} {i18nService.t('orchestratorNodesUnit')}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                          graph.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : graph.status === 'failed'
                              ? 'bg-red-500/10 text-red-600'
                              : graph.status === 'running'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-surface-raised text-secondary'
                        }`}>
                          {getGraphStatusLabel(graph.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-secondary">
                        {formatTimestamp(graph.createdAt)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-5 py-4">
              {inlineError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                  {inlineError}
                </div>
              )}

              {!selectedGraph ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-6 text-center text-sm text-secondary">
                  {i18nService.t('orchestratorSelectGraph')}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-foreground">
                          {selectedGraph.name}
                        </h2>
                        <div className="mt-1 text-sm text-secondary">
                          {selectedGraph.description}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleExecute()}
                          disabled={isExecuting || selectedGraph.status === 'running'}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                        >
                          <PlayIcon className="h-4 w-4" />
                          {i18nService.t('orchestratorExecute')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancel()}
                          disabled={actionGraphId === selectedGraph.id || selectedGraph.status !== 'running'}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
                        >
                          <StopIcon className="h-4 w-4" />
                          {i18nService.t('orchestratorCancel')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('orchestratorGraphStatus')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{getGraphStatusLabel(selectedGraph.status)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('orchestratorCreatedAt')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{formatTimestamp(selectedGraph.createdAt)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('orchestratorCompletedNodes')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{completedNodes}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('orchestratorFailedNodes')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{failedNodes}</div>
                      </div>
                    </div>
                  </div>

                  {summary && (
                    <div className="rounded-lg border border-border bg-surface p-4">
                      <h3 className="text-sm font-semibold text-foreground">
                        {i18nService.t('orchestratorSummary')}
                      </h3>
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-secondary">
                        {summary}
                      </pre>
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      {i18nService.t('orchestratorNodesTitle')}
                    </h3>
                    <div className="mt-3 space-y-3">
                      {selectedGraph.nodes.map((node) => (
                        <div key={node.id} className="rounded-lg border border-border bg-background px-3 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">{node.id}</div>
                              <div className="mt-1 text-xs text-secondary">
                                {node.agentEngine}
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                              node.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : node.status === 'failed'
                                  ? 'bg-red-500/10 text-red-600'
                                  : node.status === 'running'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : 'bg-surface-raised text-secondary'
                            }`}>
                              {getNodeStatusLabel(node.status)}
                            </span>
                          </div>
                          <div className="mt-3 whitespace-pre-wrap text-sm text-secondary">
                            {node.prompt}
                          </div>
                          {node.dependsOn.length > 0 && (
                            <div className="mt-3 text-xs text-secondary">
                              {i18nService.t('orchestratorDependsOn')}: {node.dependsOn.join(', ')}
                            </div>
                          )}
                          {node.result && (
                            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-3 text-xs text-foreground">
                              {node.result}
                            </pre>
                          )}
                          {node.error && (
                            <div className="mt-3 text-xs text-red-600">
                              {node.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrchestratorView;
