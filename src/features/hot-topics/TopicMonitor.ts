/**
 * Core topic monitor — schedules crawling, dispatches events.
 */

import { EventEmitter } from 'events';

import type { ResearchSession } from '../deep-research';
import { DocumentProcessor } from '../knowledge-base/DocumentProcessor';
import { EmbeddingEngine } from '../knowledge-base/EmbeddingEngine';
import { KnowledgeStore } from '../knowledge-base/KnowledgeStore';
import { CrawlerFactory } from './crawlers/index';
import {
  type ActionDispatcher,
  DefaultActionDispatcher,
  type TopicActionIMGateway,
} from './TopicActions';
import { TopicClassifier } from './TopicClassifier';
import { TopicDigestGenerator } from './TopicDigest';
import type {
  CrawlResult,
  DigestReadyEvent,
  MonitorErrorEvent,
  NewTopicEvent,
  SourceConfig,
  TopicAction,
  TopicActionResult,
  TopicDigest,
  TopicItem,
} from './types';

export interface TopicMonitorOptions {
  classifier?: TopicClassifier;
  digestGenerator?: TopicDigestGenerator;
  actionDispatcher?: ActionDispatcher;
  getIMGatewayManager?: () => TopicActionIMGateway | null;
  researchSession?: Pick<ResearchSession, 'create'>;
  knowledgeStore?: KnowledgeStore;
  documentProcessor?: DocumentProcessor;
  embeddingEngine?: EmbeddingEngine;
}

export class TopicMonitor extends EventEmitter {
  private sources: SourceConfig[] = [];
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private topics: Map<string, TopicItem> = new Map();
  private active: boolean = false;
  private classifier: TopicClassifier;
  private digestGenerator: TopicDigestGenerator;
  private actionDispatcher: ActionDispatcher;
  private researchSession?: Pick<ResearchSession, 'create'>;
  private knowledgeStore?: KnowledgeStore;
  private documentProcessor: DocumentProcessor;
  private embeddingEngine: EmbeddingEngine;

  constructor(options: TopicMonitorOptions = {}) {
    super();
    this.classifier = options.classifier ?? new TopicClassifier();
    this.digestGenerator = options.digestGenerator ?? new TopicDigestGenerator();
    this.actionDispatcher = options.actionDispatcher ?? new DefaultActionDispatcher({
      getIMGatewayManager: options.getIMGatewayManager,
    });
    this.researchSession = options.researchSession;
    this.knowledgeStore = options.knowledgeStore;
    this.documentProcessor = options.documentProcessor ?? new DocumentProcessor();
    this.embeddingEngine = options.embeddingEngine ?? new EmbeddingEngine();
    this.on('error', () => {
      // Prevent unhandled EventEmitter error events when no consumer is attached yet.
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start monitoring the given sources.
   * Each source is fetched immediately, then on its configured interval.
   */
  start(sources: SourceConfig[]): void {
    this.stop();
    this.sources = sources.map((source) => ({ ...source }));
    this.active = true;

    for (const cfg of this.sources) {
      if (!cfg.enabled) continue;

      // Run immediately
      void this.fetchSource(cfg);

      // Schedule recurring
      const ms = cfg.interval * 1000;
      const timer = setInterval(() => {
        void this.fetchSource(cfg);
      }, ms);

      this.timers.set(cfg.source, timer);
    }
  }

  /**
   * Stop all monitoring timers.
   */
  stop(): void {
    this.active = false;
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get the digest for today based on all discovered topics.
   */
  async getTodayDigest(): Promise<TopicDigest> {
    const today = new Date().toISOString().slice(0, 10);
    const topics = this.getAllTopics()
      .filter((topic) => topic.discoveredAt.slice(0, 10) === today);
    const digest = this.digestGenerator.generateDigest(topics);

    return {
      ...digest,
      aiSummary: await this.digestGenerator.summarizeWithAI(digest.topics),
    };
  }

  /**
   * Trigger deep research on a topic.
   */
  async startResearch(topicId: string): Promise<TopicActionResult> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      return this.createFailure(topicId, 'research', `Topic not found: ${topicId}`);
    }

    if (!this.researchSession) {
      return this.actionDispatcher.research({
        topicId,
        depth: 'quick',
        sources: this.inferResearchSources(topic),
      });
    }

    const session = this.researchSession.create({
      query: this.buildResearchPrompt(topic),
      sources: this.inferResearchSources(topic),
      maxRounds: topic.source === 'arxiv' ? 3 : 2,
      crossValidate: true,
    });

    return {
      topicId: topic.id,
      action: 'research' as TopicAction,
      success: true,
      result: `Research initiated for topic "${topic.title}"`,
      payload: { sessionId: session.id, session },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Trigger content generation from a topic.
   */
  async startWriting(topicId: string, style?: string): Promise<TopicActionResult> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      return this.createFailure(topicId, 'writing', `Topic not found: ${topicId}`);
    }

    const actionResult = await this.actionDispatcher.writing({
      topicId,
      topic,
      style: (style as 'news' | 'analysis' | 'summary' | 'thread' | undefined) ?? 'summary',
    });

    return {
      ...actionResult,
      payload: {
        ...(isRecord(actionResult.payload) ? actionResult.payload : {}),
        topic,
      },
    };
  }

  /**
   * Push a topic to IM channels.
   */
  async pushToIM(topicId: string, channels: string[]): Promise<TopicActionResult> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      return this.createFailure(topicId, 'push', `Topic not found: ${topicId}`);
    }

    const actionResult = await this.actionDispatcher.push({
      topicId,
      topic,
      channels,
      format: 'text',
    });

    return {
      ...actionResult,
      payload: {
        ...(isRecord(actionResult.payload) ? actionResult.payload : {}),
        topic,
        channels,
      },
    };
  }

  /**
   * Save a topic into the knowledge base.
   */
  async saveToKnowledge(topicId: string): Promise<TopicActionResult> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      return this.createFailure(topicId, 'save', `Topic not found: ${topicId}`);
    }

    if (!this.knowledgeStore) {
      return this.actionDispatcher.save({
        topicId,
        targetCollection: 'hot-topics',
        tags: topic.tags,
      });
    }

    const documents = this.documentProcessor.processMarkdown(
      this.buildKnowledgeDocument(topic),
      {
        title: `Hot Topic: ${topic.title}`,
        source: 'hot-topic',
        tags: ['hot-topic', topic.source, ...topic.tags],
      },
    );
    const normalized = documents.map((document, index) => ({
      ...document,
      id: `hot-topic-${topic.id}-${index + 1}`,
      sourceId: topic.id,
      metadata: {
        ...document.metadata,
        tags: [...new Set(['hot-topic', topic.source, ...topic.tags, ...document.metadata.tags])],
        createdAt: topic.discoveredAt,
        updatedAt: new Date().toISOString(),
      },
    }));
    const embedded = await this.embeddingEngine.embedDocuments(normalized);

    await Promise.all(embedded.map(async (document) => {
      await this.knowledgeStore?.save(document);
    }));

    return {
      topicId: topic.id,
      action: 'save' as TopicAction,
      success: true,
      result: `Topic "${topic.title}" saved to knowledge base`,
      payload: {
        documentIds: embedded.map((document) => document.id),
      },
      timestamp: new Date().toISOString(),
    };
  }

  listTopics(limit?: number): TopicItem[] {
    const topics = this.getAllTopics();
    return typeof limit === 'number' ? topics.slice(0, limit) : topics;
  }

  getTopic(topicId: string): TopicItem | null {
    return this.topics.get(topicId) ?? null;
  }

  getSources(): SourceConfig[] {
    return this.sources.map((source) => ({ ...source }));
  }

  isActive(): boolean {
    return this.active;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async fetchSource(cfg: SourceConfig): Promise<void> {
    try {
      const adapter = CrawlerFactory.create(cfg.source);
      const result: CrawlResult = await adapter.fetch(cfg.config);
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.topics.length === 0) return;

      const incomingTopics = result.topics.map((topic) => ({
        ...topic,
        score: this.classifier.score(topic),
        tags: [...new Set(topic.tags)],
      }));
      const currentTopicIds = new Set(this.topics.keys());
      const currentTopics = this.getAllTopics();
      const mergedTopics = this.classifier.deduplicate(
        [...incomingTopics, ...currentTopics].sort((left, right) => {
          const timeDiff =
            new Date(right.discoveredAt).getTime() -
            new Date(left.discoveredAt).getTime();
          return timeDiff !== 0 ? timeDiff : right.score - left.score;
        }),
      );
      const incomingTopicIds = new Set(incomingTopics.map((topic) => topic.id));

      this.topics.clear();
      for (const topic of mergedTopics) {
        this.topics.set(topic.id, topic);
      }

      const newTopics = mergedTopics.filter((topic) =>
        incomingTopicIds.has(topic.id) && !currentTopicIds.has(topic.id),
      );
      if (newTopics.length === 0) return;

      // Emit new-topic events
      for (const topic of newTopics) {
        const event: NewTopicEvent = {
          type: 'new-topic',
          topic,
        };
        this.emit('new-topic', event);
      }

      // Classify & generate digest
      const allTopics = this.getAllTopics();
      const digest = await this.digestGenerator.generateDigest(allTopics);

      const digestEvent: DigestReadyEvent = {
        type: 'digest-ready',
        digest: {
          ...digest,
          aiSummary: await this.digestGenerator.summarizeWithAI(digest.topics),
        },
      };
      this.emit('digest-ready', digestEvent);
    } catch (err) {
      const errorEvent: MonitorErrorEvent = {
        type: 'error',
        error: err instanceof Error ? err : new Error(String(err)),
        source: cfg.source,
      };
      this.emit('error', errorEvent);
    }
  }

  private getAllTopics(): TopicItem[] {
    return Array.from(this.topics.values()).sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (
        new Date(right.discoveredAt).getTime() -
        new Date(left.discoveredAt).getTime()
      );
    });
  }

  private inferResearchSources(topic: TopicItem): Array<'web' | 'scholar' | 'social'> {
    if (topic.source === 'arxiv') {
      return ['scholar', 'web'];
    }

    if (topic.source === 'hacker-news' || topic.source === 'reddit') {
      return ['web', 'social'];
    }

    return ['web'];
  }

  private buildResearchPrompt(topic: TopicItem): string {
    return [
      topic.title,
      topic.summary ? `Summary: ${topic.summary}` : null,
      `Source: ${topic.source}`,
      `URL: ${topic.url}`,
      topic.tags.length > 0 ? `Tags: ${topic.tags.join(', ')}` : null,
    ]
      .filter((entry): entry is string => Boolean(entry))
      .join('\n');
  }

  private buildKnowledgeDocument(topic: TopicItem): string {
    return [
      `# ${topic.title}`,
      '',
      topic.summary,
      '',
      `- Source: ${topic.source}`,
      `- URL: ${topic.url}`,
      `- Score: ${topic.score}`,
      `- Discovered: ${topic.discoveredAt}`,
      `- Tags: ${topic.tags.join(', ')}`,
    ].join('\n');
  }

  private createFailure(
    topicId: string,
    action: TopicAction,
    error: string,
  ): TopicActionResult {
    return {
      topicId,
      action,
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
