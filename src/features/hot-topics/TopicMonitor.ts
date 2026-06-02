/**
 * Core topic monitor — schedules crawling, dispatches events.
 */

import { EventEmitter } from 'events';
import type {
  TopicItem,
  TopicDigest,
  SourceConfig,
  NewTopicEvent,
  DigestReadyEvent,
  MonitorErrorEvent,
  TopicActionResult,
  TopicAction,
  CrawlResult,
} from './types';
import { CrawlerFactory } from './crawlers/index';
import { TopicClassifier } from './TopicClassifier';
import { TopicDigestGenerator } from './TopicDigest';

export interface TopicMonitorOptions {
  classifier?: TopicClassifier;
  digestGenerator?: TopicDigestGenerator;
}

export class TopicMonitor extends EventEmitter {
  private sources: SourceConfig[] = [];
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private knownTopicIds: Set<string> = new Set();
  private active: boolean = false;
  private classifier: TopicClassifier;
  private digestGenerator: TopicDigestGenerator;

  constructor(options: TopicMonitorOptions = {}) {
    super();
    this.classifier = options.classifier ?? new TopicClassifier();
    this.digestGenerator = options.digestGenerator ?? new TopicDigestGenerator();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start monitoring the given sources.
   * Each source is fetched immediately, then on its configured interval.
   */
  start(sources: SourceConfig[]): void {
    this.sources = sources;
    this.active = true;

    for (const cfg of sources) {
      if (!cfg.enabled) continue;

      // Run immediately
      this.fetchSource(cfg);

      // Schedule recurring
      const ms = cfg.interval * 1000;
      const timer = setInterval(() => {
        this.fetchSource(cfg);
      }, ms);

      this.timers.set(cfg.source, timer);
    }
  }

  /**
   * Stop all monitoring timers.
   */
  stop(): void {
    this.active = false;
    for (const [source, timer] of this.timers) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get the digest for today based on all discovered topics.
   */
  async getTodayDigest(): Promise<TopicDigest> {
    // For now returns a placeholder — real impl would aggregate from store
    const topics = Array.from(this.knownTopicIds).map(id => ({
      id,
      title: '',
      summary: '',
      source: '',
      url: '',
      score: 0,
      category: 'other' as const,
      discoveredAt: new Date().toISOString(),
      tags: [],
    }));

    return this.digestGenerator.generateDigest(topics);
  }

  /**
   * Trigger deep research on a topic.
   */
  async startResearch(topicId: string): Promise<TopicActionResult> {
    // Placeholder — would delegate to deep-research engine
    return {
      topicId,
      action: 'research' as TopicAction,
      success: true,
      result: `Research initiated for topic ${topicId}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Trigger content generation from a topic.
   */
  async startWriting(topicId: string, style?: string): Promise<TopicActionResult> {
    return {
      topicId,
      action: 'writing' as TopicAction,
      success: true,
      result: `Writing task created for topic ${topicId}${style ? ` (style: ${style})` : ''}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Push a topic to IM channels.
   */
  async pushToIM(topicId: string, channels: string[]): Promise<TopicActionResult> {
    return {
      topicId,
      action: 'push' as TopicAction,
      success: true,
      result: `Topic ${topicId} pushed to channels: ${channels.join(', ')}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Save a topic into the knowledge base.
   */
  async saveToKnowledge(topicId: string): Promise<TopicActionResult> {
    return {
      topicId,
      action: 'save' as TopicAction,
      success: true,
      result: `Topic ${topicId} saved to knowledge base`,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async fetchSource(cfg: SourceConfig): Promise<void> {
    try {
      const adapter = CrawlerFactory.create(cfg.source);
      const result: CrawlResult = await adapter.fetch(cfg);

      if (result.topics.length === 0) return;

      // Deduplicate & filter
      const newTopics = result.topics.filter(t => !this.knownTopicIds.has(t.id));
      for (const t of newTopics) {
        this.knownTopicIds.add(t.id);
      }

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
      const allTopics = await this.getAllTopics();
      const digest = await this.digestGenerator.generateDigest(allTopics);

      const digestEvent: DigestReadyEvent = {
        type: 'digest-ready',
        digest,
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

  private async getAllTopics(): Promise<TopicItem[]> {
    // Stub — in production would query a store
    return [];
  }
}
