import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useState } from 'react';

import type {
  ContentType,
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeSource,
} from '../../../features/knowledge-base';
import { i18nService } from '../../services/i18n';
import { type KnowledgeSearchRequest,knowledgeService } from '../../services/knowledge';
import ComposeIcon from '../icons/ComposeIcon';
import PlusCircleIcon from '../icons/PlusCircleIcon';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import MarkdownContent from '../MarkdownContent';
import ThemedSelect from '../ui/ThemedSelect';
import WindowTitleBar from '../window/WindowTitleBar';

interface KnowledgeBaseViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

type KnowledgeMode = NonNullable<KnowledgeSearchRequest['mode']>;
type KnowledgeSourceFilter = KnowledgeSource | 'all';

interface KnowledgeListItem {
  document: KnowledgeDocument;
  score?: number;
  snippet?: string;
  matchType?: KnowledgeSearchResult['matchType'];
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

const parseTags = (value: string): string[] => {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const getSourceLabel = (source: KnowledgeSource): string => {
  switch (source) {
    case 'conversation':
      return i18nService.t('knowledgeSourceConversation');
    case 'research':
      return i18nService.t('knowledgeSourceResearch');
    case 'hot-topic':
      return i18nService.t('knowledgeSourceHotTopic');
    default:
      return i18nService.t('knowledgeSourceManual');
  }
};

const getContentTypeLabel = (contentType: ContentType): string => {
  switch (contentType) {
    case 'text':
      return i18nService.t('knowledgeContentTypeText');
    case 'html':
      return i18nService.t('knowledgeContentTypeHtml');
    case 'json':
      return i18nService.t('knowledgeContentTypeJson');
    default:
      return i18nService.t('knowledgeContentTypeMarkdown');
  }
};

const filterDocuments = (
  documents: KnowledgeDocument[],
  source: KnowledgeSourceFilter,
  tags: string[],
): KnowledgeDocument[] => {
  return documents.filter((document) => {
    if (source !== 'all' && document.source !== source) {
      return false;
    }

    if (tags.length > 0 && !tags.every((tag) => document.metadata.tags.includes(tag))) {
      return false;
    }

    return true;
  });
};

const renderDocumentContent = (document: KnowledgeDocument): React.ReactNode => {
  if (document.contentType === 'markdown') {
    return <MarkdownContent content={document.content} />;
  }

  if (document.contentType === 'json') {
    try {
      return (
        <pre className="whitespace-pre-wrap text-sm text-foreground">
          {JSON.stringify(JSON.parse(document.content), null, 2)}
        </pre>
      );
    } catch (_error) {
      return <pre className="whitespace-pre-wrap text-sm text-foreground">{document.content}</pre>;
    }
  }

  return <pre className="whitespace-pre-wrap text-sm text-foreground">{document.content}</pre>;
};

const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  updateBadge,
}) => {
  const isMac = window.electron.platform === 'darwin';
  const [items, setItems] = useState<KnowledgeListItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<KnowledgeSourceFilter>('all');
  const [mode, setMode] = useState<KnowledgeMode>('hybrid');
  const [searchTags, setSearchTags] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftContentType, setDraftContentType] = useState<ContentType>('markdown');
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionDocumentId, setActionDocumentId] = useState<string | null>(null);
  const sourceOptions = [
    { value: 'all', label: i18nService.t('knowledgeSourceAll') },
    { value: 'manual', label: i18nService.t('knowledgeSourceManual') },
    { value: 'research', label: i18nService.t('knowledgeSourceResearch') },
    { value: 'conversation', label: i18nService.t('knowledgeSourceConversation') },
    { value: 'hot-topic', label: i18nService.t('knowledgeSourceHotTopic') },
  ];
  const modeOptions = [
    { value: 'hybrid', label: i18nService.t('knowledgeModeHybrid') },
    { value: 'keyword', label: i18nService.t('knowledgeModeKeyword') },
    { value: 'embedding', label: i18nService.t('knowledgeModeEmbedding') },
    { value: 'entity', label: i18nService.t('knowledgeModeEntity') },
  ];
  const contentTypeOptions = [
    { value: 'markdown', label: i18nService.t('knowledgeContentTypeMarkdown') },
    { value: 'text', label: i18nService.t('knowledgeContentTypeText') },
    { value: 'html', label: i18nService.t('knowledgeContentTypeHtml') },
    { value: 'json', label: i18nService.t('knowledgeContentTypeJson') },
  ];

  const loadDocuments = useCallback(async (options?: {
    query?: string;
    source?: KnowledgeSourceFilter;
    mode?: KnowledgeMode;
    tags?: string;
  }) => {
    const nextQuery = options?.query ?? query;
    const nextSource = options?.source ?? sourceFilter;
    const nextMode = options?.mode ?? mode;
    const nextTags = parseTags(options?.tags ?? searchTags);

    setLoading(true);

    try {
      let nextItems: KnowledgeListItem[];
      if (nextQuery.trim()) {
        const results = await knowledgeService.search(nextQuery.trim(), {
          limit: 50,
          source: nextSource === 'all' ? undefined : nextSource,
          tags: nextTags.length > 0 ? nextTags : undefined,
          mode: nextMode,
        });
        nextItems = results.map((result) => ({
          document: result.document,
          score: result.score,
          snippet: result.snippet,
          matchType: result.matchType,
        }));
      } else {
        const documents = await knowledgeService.list(0, 50);
        nextItems = filterDocuments(documents, nextSource, nextTags).map((document) => ({
          document,
        }));
      }

      setItems(nextItems);
      setSelectedDocumentId((current) => {
        if (current && nextItems.some((item) => item.document.id === current)) {
          return current;
        }
        return nextItems[0]?.document.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [mode, query, searchTags, sourceFilter]);

  useEffect(() => {
    void loadDocuments({
      query: '',
      source: 'all',
      mode: 'hybrid',
      tags: '',
    });
  }, [loadDocuments]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setSelectedDocument(null);
      return;
    }

    const currentItem = items.find((item) => item.document.id === selectedDocumentId);
    if (currentItem) {
      setSelectedDocument(currentItem.document);
    }

    let cancelled = false;
    const loadDocument = async () => {
      setDetailsLoading(true);
      try {
        const document = await knowledgeService.get(selectedDocumentId);
        if (!cancelled && document) {
          setSelectedDocument(document);
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [items, selectedDocumentId]);

  const handleSearch = useCallback(async () => {
    await loadDocuments();
  }, [loadDocuments]);

  const handleReset = useCallback(async () => {
    setQuery('');
    setSourceFilter('all');
    setMode('hybrid');
    setSearchTags('');
    await loadDocuments({
      query: '',
      source: 'all',
      mode: 'hybrid',
      tags: '',
    });
  }, [loadDocuments]);

  const handleAddDocument = useCallback(async () => {
    if (!draftTitle.trim()) {
      showToast(i18nService.t('knowledgeEnterTitle'));
      return;
    }

    if (!draftContent.trim()) {
      showToast(i18nService.t('knowledgeEnterContent'));
      return;
    }

    setIsSubmitting(true);

    try {
      const document = await knowledgeService.add({
        title: draftTitle.trim(),
        source: 'manual',
        content: draftContent.trim(),
        contentType: draftContentType,
        metadata: {
          tags: parseTags(draftTags),
        },
      });

      if (!document) {
        showToast(i18nService.t('knowledgeAddFailed'));
        return;
      }

      setDraftTitle('');
      setDraftContent('');
      setDraftTags('');
      setDraftContentType('markdown');
      showToast(i18nService.t('knowledgeAddSuccess'));
      await loadDocuments();
      setSelectedDocumentId(document.id);
    } catch (error) {
      console.error('Failed to add knowledge document:', error);
      showToast(i18nService.t('knowledgeAddFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [draftContent, draftContentType, draftTags, draftTitle, loadDocuments]);

  const handleDeleteDocument = useCallback(async () => {
    if (!selectedDocumentId) {
      return;
    }

    setActionDocumentId(selectedDocumentId);

    try {
      const deleted = await knowledgeService.delete(selectedDocumentId);
      if (!deleted) {
        showToast(i18nService.t('knowledgeDeleteFailed'));
        return;
      }

      showToast(i18nService.t('knowledgeDeleteSuccess'));
      setSelectedDocument(null);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete knowledge document:', error);
      showToast(i18nService.t('knowledgeDeleteFailed'));
    } finally {
      setActionDocumentId(null);
    }
  }, [loadDocuments, selectedDocumentId]);

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
            {i18nService.t('knowledgeTitle')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-y-auto border-r border-border bg-surface/60 p-4 [scrollbar-gutter:stable]">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('knowledgeSearch')}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {i18nService.t('knowledgeDescription')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-secondary">
                  {i18nService.t('knowledgeSearch')}
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={i18nService.t('knowledgeSearchPlaceholder')}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
              </div>

              <ThemedSelect
                id="knowledge-source-filter"
                value={sourceFilter}
                onChange={(value) => setSourceFilter(value as KnowledgeSourceFilter)}
                options={sourceOptions}
                label={i18nService.t('knowledgeSourceLabel')}
              />

              <ThemedSelect
                id="knowledge-mode-filter"
                value={mode}
                onChange={(value) => setMode(value as KnowledgeMode)}
                options={modeOptions}
                label={i18nService.t('knowledgeModeLabel')}
              />

              <div>
                <div className="mb-1 text-xs font-medium text-secondary">
                  {i18nService.t('knowledgeTagsLabel')}
                </div>
                <input
                  type="text"
                  value={searchTags}
                  onChange={(event) => setSearchTags(event.target.value)}
                  placeholder={i18nService.t('knowledgeTagsPlaceholder')}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  {i18nService.t('knowledgeSearch')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleReset()}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  {i18nService.t('knowledgeReset')}
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('knowledgeAddDocument')}
              </h2>
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder={i18nService.t('knowledgeTitlePlaceholder')}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
                <ThemedSelect
                  id="knowledge-content-type"
                  value={draftContentType}
                  onChange={(value) => setDraftContentType(value as ContentType)}
                  options={contentTypeOptions}
                  label={i18nService.t('knowledgeContentTypeLabel')}
                />
                <input
                  type="text"
                  value={draftTags}
                  onChange={(event) => setDraftTags(event.target.value)}
                  placeholder={i18nService.t('knowledgeTagsPlaceholder')}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
                <textarea
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  placeholder={i18nService.t('knowledgeContentPlaceholder')}
                  className="min-h-[140px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => void handleAddDocument()}
                  disabled={isSubmitting}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                >
                  <PlusCircleIcon className="h-4 w-4" />
                  {isSubmitting ? i18nService.t('loading') : i18nService.t('knowledgeAddDocument')}
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {i18nService.t('knowledgeDocumentsTitle')}
              </h2>
              <button
                type="button"
                onClick={() => void handleSearch()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {i18nService.t('knowledgeRefresh')}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="rounded-lg border border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('loading')}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-sm text-secondary">
                  {i18nService.t('knowledgeNoDocuments')}
                </div>
              ) : (
                items.map((item) => {
                  const isSelected = item.document.id === selectedDocumentId;
                  return (
                    <button
                      key={item.document.id}
                      type="button"
                      onClick={() => setSelectedDocumentId(item.document.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-background hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {item.document.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-secondary">
                            {getSourceLabel(item.document.source)}
                            {typeof item.score === 'number' ? ` · ${(item.score * 100).toFixed(0)}%` : ''}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-surface-raised px-2 py-1 text-[11px] font-medium text-secondary">
                          {getContentTypeLabel(item.document.contentType)}
                        </span>
                      </div>
                      {item.snippet && (
                        <div className="mt-2 line-clamp-2 text-xs text-secondary whitespace-pre-wrap">
                          {item.snippet}
                        </div>
                      )}
                      <div className="mt-2 truncate text-xs text-secondary">
                        {item.document.metadata.tags.join(', ') || '-'}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-5 py-4">
              {!selectedDocument ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-6 text-center text-sm text-secondary">
                  {i18nService.t('knowledgeSelectDocument')}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-foreground">
                          {selectedDocument.title}
                        </h2>
                        <div className="mt-1 text-sm text-secondary">
                          {getSourceLabel(selectedDocument.source)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDeleteDocument()}
                        disabled={actionDocumentId === selectedDocument.id}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/30 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {i18nService.t('knowledgeDeleteDocument')}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('knowledgeContentTypeLabel')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{getContentTypeLabel(selectedDocument.contentType)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('knowledgeCreatedAt')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{formatTimestamp(selectedDocument.metadata.createdAt)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('knowledgeUpdatedAt')}</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{formatTimestamp(selectedDocument.metadata.updatedAt)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-3">
                        <div className="text-xs text-secondary">{i18nService.t('knowledgeSourceId')}</div>
                        <div className="mt-1 truncate text-sm font-medium text-foreground">{selectedDocument.sourceId || '-'}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3">
                      <div className="text-xs text-secondary">{i18nService.t('knowledgeTagsLabel')}</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {selectedDocument.metadata.tags.join(', ') || '-'}
                      </div>
                    </div>
                  </div>

                  {detailsLoading ? (
                    <div className="rounded-lg border border-border bg-surface px-4 py-6 text-sm text-secondary">
                      {i18nService.t('loading')}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-surface p-4">
                      {renderDocumentContent(selectedDocument)}
                    </div>
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

export default KnowledgeBaseView;
