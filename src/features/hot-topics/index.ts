/**
 * Hot Topics feature — barrel exports.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type {
  TopicCategory,
  TopicItem,
  TopicDigest,
  SourceConfig,
  TopicAction,
  TopicActionRequest,
  TopicActionResult,
  NewTopicEvent,
  DigestReadyEvent,
  MonitorErrorEvent,
  TopicMonitorEvent,
  ClassifiedTopics,
  ClassificationResult,
  ScoreWeights,
  CrawlResult,
  CrawlerOptions,
} from './types';

export { DEFAULT_SCORE_WEIGHTS } from './types';

// ── Monitor ─────────────────────────────────────────────────────────────────

export { TopicMonitor } from './TopicMonitor';
export type { TopicMonitorOptions } from './TopicMonitor';

// ── Classifier ──────────────────────────────────────────────────────────────

export { TopicClassifier } from './TopicClassifier';

// ── Digest ─────────────────────────────────────────────────────────────────

export { TopicDigestGenerator } from './TopicDigest';

// ── Actions ─────────────────────────────────────────────────────────────────

export { DefaultActionDispatcher } from './TopicActions';
export type {
  ResearchActionOptions,
  WritingActionOptions,
  PushActionOptions,
  SaveActionOptions,
  ActionDispatcher,
} from './TopicActions';

// ── Crawlers ────────────────────────────────────────────────────────────────

export { CrawlerFactory, HackerNewsCrawler, TwitterCrawler, RedditCrawler, ArxivCrawler, WeiboCrawler, CustomCrawler } from './crawlers/index';
export type { CrawlerAdapter, CustomCrawlerConfig } from './crawlers/index';
