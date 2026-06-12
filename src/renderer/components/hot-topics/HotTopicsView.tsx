import {
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  SourceConfig,
  TopicActionResult,
  TopicDigest,
  TopicItem,
  TopicMonitorEvent,
} from '../../../features/hot-topics';
import { hotTopicsService } from '../../services/hotTopics';
import { i18nService } from '../../services/i18n';
import ComposeIcon from '../icons/ComposeIcon';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ThemedSelect from '../ui/ThemedSelect';
import WindowTitleBar from '../window/WindowTitleBar';

interface HotTopicsViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

const DEFAULT_SOURCE_CONFIGS: SourceConfig[] = [
  { source: 'hacker-news', enabled: true, interval: 1800 },
  { source: 'reddit', enabled: true, interval: 1800 },
  { source: 'arxiv', enabled: true, interval: 3600 },
  { source: 'twitter', enabled: false, interval: 1800 },
  { source: 'weibo', enabled: false, interval: 1800 },
  { source: 'custom', enabled: false, interval: 1800 },
];

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

const getSourceLabel = (source: string): string => {
  switch (source) {
    case 'hacker-news':
      return 'Hacker News';
    case 'arxiv':
      return 'arXiv';
    case 'weibo':
      return 'Weibo';
    default:
      return source;
  }
};

const getCategoryLabel = (category: TopicItem['category']): string => {
  switch (category) {
    case 'ai':
      return i18nService.t('hotTopicsCategoryAi');
    case 'tech':
      return i18nService.t('hotTopicsCategoryTech');
    case 'science':
      return i18nService.t('hotTopicsCategoryScience');
    case 'finance':
      return i18nService.t('hotTopicsCategoryFinance');
    case 'politics':
      return i18nService.t('hotTopicsCategoryPolitics');
    case 'social':
      return i18nService.t('hotTopicsCategorySocial');
    case 'entertainment':
      return i18nService.t('hotTopicsCategoryEntertainment');
    case 'health':
      return i18nService.t('hotTopicsCategoryHealth');
    case 'education':
      return i18nService.t('hotTopicsCategoryEducation');
    default:
      return i18nService.t('hotTopicsCategoryOther');
  }
};

const mergeSourceConfigs = (sources: SourceConfig[]): SourceConfig[] => {
  const currentBySource = new Map(sources.map((source) => [source.source, source]));
  return DEFAULT_SOURCE_CONFIGS.map((defaults) => currentBySource.get(defaults.source) ?? defaults);
};

const getActionMessage = (result: TopicActionResult | null): string | null => {
  if (!result) {
    return null;
  }

  if (result.success) {
    return result.result ?? null;
  }

  return result.error ?? null;
};

type ActionDraft = {
  title: string;
  content: string;
  format: 'markdown' | 'text';
  estimatedWords?: number;
  style?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const getActionDraft = (result: TopicActionResult | null): ActionDraft | null => {
  if (!result || result.action !== 'writing' || !isRecord(result.payload)) {
    return null;
  }

  const { draftTitle, draft, format, estimatedWords, style } = result.payload;
  if (typeof draftTitle !== 'string' || typeof draft !== 'string') {
    return null;
  }

  return {
    title: draftTitle,
    content: draft,
    format: format === 'text' ? 'text' : 'markdown',
    estimatedWords: typeof estimatedWords === 'number' ? estimatedWords : undefined,
    style: typeof style === 'string' ? style : undefined,
  };
};

const HotTopicsView: React.FC<HotTopicsViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  updateBadge,
}) => {
  const isMac = window.electron.platform === 'darwin';
  const [sources, setSources] = useState<SourceConfig[]>(DEFAULT_SOURCE_CONFIGS);
  const [active, setActive] = useState(false);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [digest, setDigest] = useState<TopicDigest | null>(null);
  const [writingStyle, setWritingStyle] = useState('summary');
  const [channelsText, setChannelsText] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionTopicId, setActionTopicId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedTopicId, topics],
  );
  const styleOptions = [
    { value: 'summary', label: i18nService.t('hotTopicsStyleSummary') },
    { value: 'analysis', label: i18nService.t('hotTopicsStyleAnalysis') },
    { value: 'news', label: i18nService.t('hotTopicsStyleNews') },
    { value: 'thread', label: i18nService.t('hotTopicsStyleThread') },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    setInlineError(null);

    try {
      const [status, nextTopics, nextDigest] = await Promise.all([
        hotTopicsService.getStatus(),
        hotTopicsService.list(50),
        hotTopicsService.getDigest(),
      ]);

      setActive(status.active);
      setSources(status.sources.length > 0 ? mergeSourceConfigs(status.sources) : DEFAULT_SOURCE_CONFIGS);
      setTopics(nextTopics);
      setDigest(nextDigest);
      setSelectedTopicId((current) => {
        if (current && nextTopics.some((topic) => topic.id === current)) {
          return current;
        }
        return nextTopics[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Failed to load hot topics data:', error);
      setInlineError(i18nService.t('hotTopicsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setActionMessage(null);
    setActionDraft(null);
  }, [selectedTopicId]);

  useEffect(() => {
    const dispose = hotTopicsService.onEvent((event: TopicMonitorEvent) => {
      if (event.type === 'new-topic') {
        showToast(i18nService.t('hotTopicsNewTopicToast'));
      } else if (event.type === 'digest-ready') {
        showToast(i18nService.t('hotTopicsDigestReadyToast'));
      } else if (event.type === 'error') {
        const message = event.error instanceof Error
          ? event.error.message
          : i18nService.t('hotTopicsActionFailed');
        showToast(`${i18nService.t('hotTopicsActionFailed')}: ${message}`);
      }

      void loadData();
    });

    return dispose;
  }, [loadData]);

  const handleToggleSource = useCallback((sourceId: string) => {
    setSources((current) => current.map((source) =>
      source.source === sourceId
        ? { ...source, enabled: !source.enabled }
        : source,
    ));
  }, []);

  const handleIntervalChange = useCallback((sourceId: string, interval: number) => {
    setSources((current) => current.map((source) =>
      source.source === sourceId
        ? { ...source, interval: Math.max(60, interval) }
        : source,
    ));
  }, []);

  const handleStartMonitor = useCallback(async () => {
    if (!sources.some((source) => source.enabled)) {
      showToast(i18nService.t('hotTopicsSelectSource'));
      return;
    }

    setStatusLoading(true);

    try {
      const status = await hotTopicsService.start(sources);
      setActive(status.active);
      setSources(status.sources.length > 0 ? mergeSourceConfigs(status.sources) : sources);
      showToast(i18nService.t('hotTopicsStartedToast'));
      await loadData();
    } catch (error) {
      console.error('Failed to start hot topics monitor:', error);
      showToast(i18nService.t('hotTopicsStartFailed'));
    } finally {
      setStatusLoading(false);
    }
  }, [loadData, sources]);

  const handleStopMonitor = useCallback(async () => {
    setStatusLoading(true);

    try {
      const stopped = await hotTopicsService.stop();
      if (!stopped) {
        showToast(i18nService.t('hotTopicsStopFailed'));
        return;
      }

      setActive(false);
      showToast(i18nService.t('hotTopicsStoppedToast'));
      await loadData();
    } catch (error) {
      console.error('Failed to stop hot topics monitor:', error);
      showToast(i18nService.t('hotTopicsStopFailed'));
    } finally {
      setStatusLoading(false);
    }
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const runTopicAction = useCallback(async (
    topicId: string,
    runner: () => Promise<TopicActionResult | null>,
  ) => {
    setActionTopicId(topicId);
    setActionMessage(null);
    setActionDraft(null);

    try {
      const result = await runner();
      const message = getActionMessage(result);
      const draft = getActionDraft(result);
      setActionDraft(draft);
      if (message) {
        setActionMessage(message);
        showToast(message);
      } else if (!result?.success) {
        showToast(i18nService.t('hotTopicsActionFailed'));
      }
    } catch (error) {
      console.error('Failed to run hot topic action:', error);
      showToast(i18nService.t('hotTopicsActionFailed'));
    } finally {
      setActionTopicId(null);
    }
  }, []);

  const handleOpenTopic = useCallback(async () => {
    if (!selectedTopic) {
      return;
    }

    await window.electron.shell.openExternal(selectedTopic.url);
  }, [selectedTopic]);

  const parsedChannels = channelsText
    .split(',')
    .map((channel) => channel.trim())
    .filter(Boolean);

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
            {i18nService.t('hotTopicsTitle')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-y-auto border-r border-border bg-surface/60 p-4 [scrollbar-gutter:stable]">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('hotTopicsMonitorSettings')}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {i18nService.t('hotTopicsDescription')}
              </p>
            </div>

            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.source} className="rounded-lg border border-border bg-background px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={() => handleToggleSource(source.source)}
                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                      />
                      {getSourceLabel(source.source)}
                    </label>
                    <input
                      type="number"
                      min={60}
                      step={60}
                      value={source.interval}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        handleIntervalChange(source.source, Number.isFinite(nextValue) ? nextValue : source.interval);
                      }}
                      className="h-9 w-24 rounded-lg border border-border bg-surface px-2 text-right text-sm text-foreground"
                    />
                  </div>
                  <div className="mt-1 text-xs text-secondary">
                    {i18nService.t('hotTopicsIntervalSeconds')}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleStartMonitor()}
                disabled={statusLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <PlayIcon className="h-4 w-4" />
                {i18nService.t('hotTopicsStartMonitor')}
              </button>
              <button
                type="button"
                onClick={() => void handleStopMonitor()}
                disabled={statusLoading || !active}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
              >
                <StopIcon className="h-4 w-4" />
                {i18nService.t('hotTopicsStopMonitor')}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3">
              <div className="text-xs text-secondary">{i18nService.t('hotTopicsMonitorStatus')}</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {active ? i18nService.t('hotTopicsRunning') : i18nService.t('hotTopicsStopped')}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('hotTopicsTopicsTitle')}
              </h2>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {i18nService.t('hotTopicsRefresh')}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="rounded-lg border border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('loading')}
                </div>
              ) : topics.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('hotTopicsNoTopics')}
                </div>
              ) : (
                topics.map((topic) => {
                  const isSelected = topic.id === selectedTopicId;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-background hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-medium text-foreground">
                            {topic.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-secondary">
                            {getSourceLabel(topic.source)} · {getCategoryLabel(topic.category)}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-surface-raised px-2 py-1 text-[11px] font-medium text-secondary">
                          {Math.round(topic.score)}
                        </span>
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

              {digest && (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      {i18nService.t('hotTopicsDigestTitle')}
                    </h2>
                    <div className="text-xs text-secondary">
                      {digest.date}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-secondary whitespace-pre-wrap">
                    {digest.aiSummary || i18nService.t('hotTopicsDigestEmpty')}
                  </div>
                </div>
              )}

              {!selectedTopic ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-6 text-center text-sm text-secondary">
                  {i18nService.t('hotTopicsSelectTopic')}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-foreground">
                          {selectedTopic.title}
                        </h2>
                        <div className="mt-1 text-sm text-secondary">
                          {getSourceLabel(selectedTopic.source)} · {getCategoryLabel(selectedTopic.category)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleOpenTopic()}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                      >
                        {i18nService.t('hotTopicsOpenSource')}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('hotTopicsScore')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{Math.round(selectedTopic.score)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('hotTopicsDiscoveredAt')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{formatTimestamp(selectedTopic.discoveredAt)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('hotTopicsSource')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{getSourceLabel(selectedTopic.source)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('hotTopicsCategory')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{getCategoryLabel(selectedTopic.category)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      {i18nService.t('hotTopicsSummary')}
                    </h3>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-secondary">
                      {selectedTopic.summary}
                    </div>
                    <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3">
                      <div className="text-xs text-secondary">{i18nService.t('hotTopicsTags')}</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {selectedTopic.tags.join(', ') || '-'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      {i18nService.t('hotTopicsActionsTitle')}
                    </h3>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => void runTopicAction(selectedTopic.id, () => hotTopicsService.startResearch(selectedTopic.id))}
                        disabled={actionTopicId === selectedTopic.id}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                      >
                        {i18nService.t('hotTopicsStartResearch')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runTopicAction(selectedTopic.id, () => hotTopicsService.saveToKnowledge(selectedTopic.id))}
                        disabled={actionTopicId === selectedTopic.id}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
                      >
                        {i18nService.t('hotTopicsSaveToKnowledge')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runTopicAction(selectedTopic.id, () => hotTopicsService.startWriting(selectedTopic.id, writingStyle))}
                        disabled={actionTopicId === selectedTopic.id}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
                      >
                        {i18nService.t('hotTopicsStartWriting')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runTopicAction(selectedTopic.id, () => hotTopicsService.pushToIM(selectedTopic.id, parsedChannels))}
                        disabled={actionTopicId === selectedTopic.id || parsedChannels.length === 0}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-60"
                      >
                        {i18nService.t('hotTopicsPushToIm')}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <ThemedSelect
                        id="hot-topics-style"
                        value={writingStyle}
                        onChange={setWritingStyle}
                        options={styleOptions}
                        label={i18nService.t('hotTopicsWritingStyle')}
                      />
                      <div>
                        <div className="mb-1 text-xs font-medium text-secondary">
                          {i18nService.t('hotTopicsImChannels')}
                        </div>
                        <input
                          type="text"
                          value={channelsText}
                          onChange={(event) => setChannelsText(event.target.value)}
                          placeholder={i18nService.t('hotTopicsImChannelsPlaceholder')}
                          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                        />
                      </div>
                    </div>

                    {actionMessage && (
                      <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3 text-sm text-secondary whitespace-pre-wrap">
                        {actionMessage}
                      </div>
                    )}

                    {actionDraft && (
                      <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-secondary">
                              {i18nService.t('hotTopicsDraftPreview')}
                            </div>
                            <div className="mt-1 text-sm font-medium text-foreground">
                              {actionDraft.title}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-secondary">
                            {actionDraft.style && (
                              <span>{actionDraft.style}</span>
                            )}
                            <span>
                              {i18nService.t('knowledgeContentTypeLabel')}
                              {': '}
                              {actionDraft.format === 'text'
                                ? i18nService.t('knowledgeContentTypeText')
                                : i18nService.t('knowledgeContentTypeMarkdown')}
                            </span>
                            {typeof actionDraft.estimatedWords === 'number' && (
                              <span>
                                {i18nService.t('hotTopicsDraftEstimatedWords')}
                                {': '}
                                {actionDraft.estimatedWords}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-3 whitespace-pre-wrap text-sm text-secondary">
                          {actionDraft.content}
                        </div>
                      </div>
                    )}
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

export default HotTopicsView;
