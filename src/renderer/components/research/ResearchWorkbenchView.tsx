import {
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ResearchResult,
  ResearchSessionEvent,
  ResearchSessionRecord,
  ResearchSourceType,
} from '../../../features/deep-research';
import { i18nService } from '../../services/i18n';
import { researchService } from '../../services/research';
import AcademicCapIcon from '../icons/AcademicCapIcon';
import ComposeIcon from '../icons/ComposeIcon';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import MarkdownContent from '../MarkdownContent';
import WindowTitleBar from '../window/WindowTitleBar';

interface ResearchWorkbenchViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

type DeliveryFeedback = {
  success: boolean;
  message: string;
};

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

const getStatusLabel = (status: ResearchSessionRecord['status']): string => {
  switch (status) {
    case 'completed':
      return i18nService.t('researchSessionCompleted');
    case 'cancelled':
      return i18nService.t('researchSessionCancelled');
    case 'error':
      return i18nService.t('researchSessionError');
    default:
      return i18nService.t('researchSessionRunning');
  }
};

const getSourceLabel = (source: ResearchSourceType): string => {
  switch (source) {
    case 'scholar':
      return i18nService.t('researchSourceScholar');
    case 'social':
      return i18nService.t('researchSourceSocial');
    default:
      return i18nService.t('researchSourceWeb');
  }
};

const upsertSessionList = (
  current: ResearchSessionRecord[],
  nextSession: ResearchSessionRecord,
): ResearchSessionRecord[] => {
  const merged = current.filter((session) => session.id !== nextSession.id);
  merged.push(nextSession);
  return merged.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const ResearchWorkbenchView: React.FC<ResearchWorkbenchViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  updateBadge,
}) => {
  const isMac = window.electron.platform === 'darwin';
  const [sessions, setSessions] = useState<ResearchSessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<ResearchResult | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sources, setSources] = useState<ResearchSourceType[]>(['web', 'scholar']);
  const [maxRounds, setMaxRounds] = useState(2);
  const [crossValidate, setCrossValidate] = useState(true);
  const [channelsText, setChannelsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState<DeliveryFeedback | null>(null);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const loadSessions = useCallback(async () => {
    const nextSessions = await researchService.list();
    setSessions(nextSessions);
    setSelectedSessionId((current) => {
      if (current && nextSessions.some((session) => session.id === current)) {
        return current;
      }
      return nextSessions[0]?.id ?? null;
    });
  }, []);

  const loadSessionDetails = useCallback(async (sessionId: string) => {
    setDetailsLoading(true);

    try {
      const [session, result, report] = await Promise.all([
        researchService.getStatus(sessionId),
        researchService.getResult(sessionId),
        researchService.getReport(sessionId),
      ]);

      if (session) {
        setSessions((current) => upsertSessionList(current, session));
      }
      setSelectedResult(result);
      setSelectedReport(report);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setInlineError(null);

      try {
        await loadSessions();
      } catch (error) {
        console.error('Failed to load research sessions:', error);
        setInlineError(i18nService.t('researchLoadFailed'));
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSelectedResult(null);
      setSelectedReport(null);
      setDeliveryFeedback(null);
      return;
    }

    void loadSessionDetails(selectedSessionId);
  }, [loadSessionDetails, selectedSessionId]);

  useEffect(() => {
    setDeliveryFeedback(null);
  }, [selectedSessionId]);

  useEffect(() => {
    const dispose = researchService.onEvent((event: ResearchSessionEvent) => {
      setSessions((current) => upsertSessionList(current, event.record));

      if (event.type === 'session:completed') {
        showToast(i18nService.t('researchCompletedToast'));
      } else if (event.type === 'session:error') {
        const errorMessage = event.record.error
          ? `${i18nService.t('researchError')}: ${event.record.error}`
          : i18nService.t('researchSessionError');
        showToast(errorMessage);
      } else if (event.type === 'session:cancelled') {
        showToast(i18nService.t('researchCancelledToast'));
      }

      if (event.sessionId === selectedSessionId) {
        void loadSessionDetails(event.sessionId);
      }
    });

    return dispose;
  }, [loadSessionDetails, selectedSessionId]);

  const handleToggleSource = useCallback((source: ResearchSourceType) => {
    setSources((current) => {
      if (current.includes(source)) {
        return current.filter((item) => item !== source);
      }
      return [...current, source];
    });
  }, []);

  const handleStartResearch = useCallback(async () => {
    if (!query.trim()) {
      showToast(i18nService.t('researchEnterQuery'));
      return;
    }

    if (sources.length === 0) {
      showToast(i18nService.t('researchChooseSource'));
      return;
    }

    setIsStarting(true);
    setInlineError(null);

    try {
      const session = await researchService.start({
        query: query.trim(),
        sources,
        maxRounds,
        crossValidate,
      });

      if (!session) {
        showToast(i18nService.t('researchStartFailed'));
        return;
      }

      setSessions((current) => upsertSessionList(current, session));
      setSelectedSessionId(session.id);
      setSelectedResult(null);
      setSelectedReport(null);
    } catch (error) {
      console.error('Failed to start research session:', error);
      showToast(i18nService.t('researchStartFailed'));
    } finally {
      setIsStarting(false);
    }
  }, [crossValidate, maxRounds, query, sources]);

  const handleCancelSession = useCallback(async () => {
    if (!selectedSessionId) {
      return;
    }

    setActionSessionId(selectedSessionId);

    try {
      const cancelled = await researchService.cancel(selectedSessionId);
      if (!cancelled) {
        showToast(i18nService.t('researchCancelFailed'));
        return;
      }

      await loadSessions();
      await loadSessionDetails(selectedSessionId);
    } catch (error) {
      console.error('Failed to cancel research session:', error);
      showToast(i18nService.t('researchCancelFailed'));
    } finally {
      setActionSessionId(null);
    }
  }, [loadSessionDetails, loadSessions, selectedSessionId]);

  const handleRefresh = useCallback(async () => {
    await loadSessions();
    if (selectedSessionId) {
      await loadSessionDetails(selectedSessionId);
    }
  }, [loadSessionDetails, loadSessions, selectedSessionId]);

  const parsedChannels = channelsText
    .split(',')
    .map((channel) => channel.trim())
    .filter(Boolean);

  const handlePushToIM = useCallback(async () => {
    if (!selectedSessionId) {
      return;
    }

    if (parsedChannels.length === 0) {
      showToast(i18nService.t('researchChooseImChannel'));
      return;
    }

    setIsDelivering(true);
    setDeliveryFeedback(null);

    try {
      const result = await researchService.pushToIM(selectedSessionId, parsedChannels);
      const message = result?.success
        ? result.result
        : result?.error;

      if (!message) {
        showToast(i18nService.t('researchDeliveryFailed'));
        setDeliveryFeedback({
          success: false,
          message: i18nService.t('researchDeliveryFailed'),
        });
        return;
      }

      setDeliveryFeedback({
        success: Boolean(result?.success),
        message,
      });
      showToast(message);
    } catch (error) {
      console.error('Failed to deliver research report to IM:', error);
      const message = i18nService.t('researchDeliveryFailed');
      setDeliveryFeedback({
        success: false,
        message,
      });
      showToast(message);
    } finally {
      setIsDelivering(false);
    }
  }, [parsedChannels, selectedSessionId]);

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
            {i18nService.t('researchTitle')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-y-auto border-r border-border bg-surface/60 p-4 [scrollbar-gutter:stable]">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('researchStart')}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {i18nService.t('researchDescription')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-secondary">
                  {i18nService.t('researchQueryLabel')}
                </div>
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={i18nService.t('researchQueryPlaceholder')}
                  className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-secondary">
                  {i18nService.t('researchSourcesLabel')}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(['web', 'scholar', 'social'] as ResearchSourceType[]).map((source) => (
                    <label
                      key={source}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={sources.includes(source)}
                        onChange={() => handleToggleSource(source)}
                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                      />
                      <span>{getSourceLabel(source)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-secondary">
                    {i18nService.t('researchMaxRounds')}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={maxRounds}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setMaxRounds(Number.isFinite(nextValue) ? Math.min(6, Math.max(1, nextValue)) : 2);
                    }}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </label>

                <label className="flex items-end">
                  <span className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={crossValidate}
                      onChange={(event) => setCrossValidate(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                    {i18nService.t('researchCrossValidate')}
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => void handleStartResearch()}
                disabled={isStarting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <PlayIcon className="h-4 w-4" />
                {isStarting ? i18nService.t('loading') : i18nService.t('researchStart')}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('researchSessionsTitle')}
              </h2>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {i18nService.t('researchRefresh')}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="rounded-lg border border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('loading')}
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('researchNoSessions')}
                </div>
              ) : (
                sessions.map((session) => {
                  const isSelected = session.id === selectedSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-background hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {session.query.query}
                          </div>
                          <div className="mt-1 truncate text-xs text-secondary">
                            {session.query.sources.map(getSourceLabel).join(' · ')}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                          session.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : session.status === 'error'
                              ? 'bg-red-500/10 text-red-600'
                              : session.status === 'cancelled'
                                ? 'bg-surface-raised text-secondary'
                                : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {getStatusLabel(session.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-secondary">
                        {formatTimestamp(session.createdAt)}
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

              {!selectedSession ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-6 text-center text-sm text-secondary">
                  {i18nService.t('researchSelectSession')}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-foreground">
                          {selectedSession.query.query}
                        </h2>
                        <div className="mt-1 text-sm text-secondary">
                          {selectedSession.query.sources.map(getSourceLabel).join(' · ')}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRefresh()}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                          {i18nService.t('researchRefresh')}
                        </button>
                        {selectedSession.status === 'running' && (
                          <button
                            type="button"
                            onClick={() => void handleCancelSession()}
                            disabled={actionSessionId === selectedSession.id}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/30 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                          >
                            <StopIcon className="h-4 w-4" />
                            {i18nService.t('researchCancel')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('researchSessionStatus')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{getStatusLabel(selectedSession.status)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('researchCreatedAt')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{formatTimestamp(selectedSession.createdAt)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('researchUpdatedAt')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{formatTimestamp(selectedSession.updatedAt)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('researchRounds')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{selectedResult?.rounds.length ?? 0}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('researchConfidence')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">
                          {selectedResult ? `${Math.round(selectedResult.confidence * 100)}%` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {detailsLoading ? (
                    <div className="rounded-lg border border-border bg-surface px-4 py-6 text-sm text-secondary">
                      {i18nService.t('loading')}
                    </div>
                  ) : selectedSession.error ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                      {selectedSession.error}
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <AcademicCapIcon className="h-4 w-4" />
                          <h3 className="text-sm font-semibold text-foreground">
                            {i18nService.t('researchReportTitle')}
                          </h3>
                        </div>
                        {selectedReport ? (
                          <MarkdownContent content={selectedReport} />
                        ) : selectedResult?.synthesis ? (
                          <MarkdownContent content={selectedResult.synthesis} />
                        ) : (
                          <div className="text-sm text-secondary">
                            {i18nService.t('researchReportUnavailable')}
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-lg border border-border bg-surface p-4">
                          <h3 className="text-sm font-semibold text-foreground">
                            {i18nService.t('researchFindings')}
                          </h3>
                          {selectedResult?.findings.length ? (
                            <div className="mt-3 space-y-3">
                              {selectedResult.findings.map((finding) => (
                                <div key={`${finding.url}-${finding.title}`} className="rounded-lg border border-border bg-background px-3 py-3">
                                  <div className="text-sm font-medium text-foreground">{finding.title}</div>
                                  <div className="mt-1 text-sm text-secondary whitespace-pre-wrap">{finding.snippet}</div>
                                  <a
                                    href={finding.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex text-xs text-primary hover:text-primary-hover"
                                  >
                                    {finding.source.title}
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-secondary">
                              {i18nService.t('researchReportUnavailable')}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-border bg-surface p-4">
                          <h3 className="text-sm font-semibold text-foreground">
                            {i18nService.t('researchSourcesFound')}
                          </h3>
                          {selectedResult?.sources.length ? (
                            <div className="mt-3 space-y-3">
                              {selectedResult.sources.map((source) => (
                                <div key={`${source.url}-${source.retrievedAt}`} className="rounded-lg border border-border bg-background px-3 py-3">
                                  <div className="text-sm font-medium text-foreground">{source.title}</div>
                                  <div className="mt-1 text-xs text-secondary">
                                    {getSourceLabel(source.type)}
                                  </div>
                                  <div className="mt-2 text-xs text-secondary">
                                    {formatTimestamp(source.retrievedAt)}
                                  </div>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex text-xs text-primary hover:text-primary-hover"
                                  >
                                    {source.url}
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-secondary">
                              {i18nService.t('researchReportUnavailable')}
                            </div>
                          )}

                          <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3">
                            <div className="text-xs text-secondary">{i18nService.t('researchSavedToKnowledge')}</div>
                            <div className="mt-1 text-sm font-medium text-foreground">
                              {selectedResult?.savedToKnowledgeBase
                                ? i18nService.t('researchSavedYes')
                                : i18nService.t('researchSavedNo')}
                            </div>
                          </div>

                          {selectedSession.status === 'completed' && (
                            <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3">
                              <div className="text-xs text-secondary">
                                {i18nService.t('researchImChannels')}
                              </div>
                              <input
                                type="text"
                                value={channelsText}
                                onChange={(event) => setChannelsText(event.target.value)}
                                placeholder={i18nService.t('researchImChannelsPlaceholder')}
                                className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                              />
                              <button
                                type="button"
                                onClick={() => void handlePushToIM()}
                                disabled={isDelivering || parsedChannels.length === 0}
                                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
                              >
                                {i18nService.t('researchPushToIm')}
                              </button>

                              {deliveryFeedback && (
                                <div
                                  className={`mt-3 rounded-lg border px-3 py-3 text-sm whitespace-pre-wrap ${
                                    deliveryFeedback.success
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                                      : 'border-red-500/30 bg-red-500/10 text-red-600'
                                  }`}
                                >
                                  {deliveryFeedback.message}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchWorkbenchView;
