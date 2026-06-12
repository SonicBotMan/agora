/**
 * Hot Topics feature — barrel exports.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type {
  ClassificationResult,
  ClassifiedTopics,
  CrawlerOptions,
  CrawlResult,
  DigestReadyEvent,
  MonitorErrorEvent,
  NewTopicEvent,
  ScoreWeights,
  SourceConfig,
  TopicAction,
  TopicActionRequest,
  TopicActionResult,
  TopicCategory,
  TopicDigest,
  TopicItem,
  TopicMonitorEvent,
} from './types';
export { DEFAULT_SCORE_WEIGHTS } from './types';

// ── Monitor ─────────────────────────────────────────────────────────────────

export type { TopicMonitorOptions } from './TopicMonitor';
export { TopicMonitor } from './TopicMonitor';

// ── Classifier ──────────────────────────────────────────────────────────────

export { TopicClassifier } from './TopicClassifier';

// ── Digest ─────────────────────────────────────────────────────────────────

export { TopicDigestGenerator } from './TopicDigest';

// ── Actions ─────────────────────────────────────────────────────────────────

export type {
  ActionDispatcher,
  PushActionOptions,
  ResearchActionOptions,
  SaveActionOptions,
  TopicActionIMGateway,
  TopicWritingDraft,
  WritingActionOptions,
} from './TopicActions';
export { DefaultActionDispatcher } from './TopicActions';

// ── Crawlers ────────────────────────────────────────────────────────────────

export type { CrawlerAdapter, CustomCrawlerConfig } from './crawlers/index';
export { ArxivCrawler, CrawlerFactory, CustomCrawler,HackerNewsCrawler, RedditCrawler, TwitterCrawler, WeiboCrawler } from './crawlers/index';
