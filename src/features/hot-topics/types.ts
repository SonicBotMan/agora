/**
 * Type definitions for the Hot Topics feature.
 */

// ── Topic Category ─────────────────────────────────────────────────────────

export type TopicCategory =
  | 'tech'
  | 'ai'
  | 'science'
  | 'finance'
  | 'politics'
  | 'social'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'other';

// ── Core Data Types ─────────────────────────────────────────────────────────

export interface TopicItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  score: number;
  category: TopicCategory;
  discoveredAt: string;
  tags: string[];
}

export interface TopicDigest {
  date: string;
  topics: TopicItem[];
  aiSummary?: string;
}

export interface SourceConfig {
  source: string;
  enabled: boolean;
  interval: number;
  config?: Record<string, unknown>;
}

// ── Topic Actions ────────────────────────────────────────────────────────────

export type TopicAction =
  | 'research'
  | 'writing'
  | 'push'
  | 'save';

export interface TopicActionRequest {
  action: TopicAction;
  topicId: string;
  style?: string;
  channels?: string[];
}

export interface TopicActionResult {
  topicId: string;
  action: TopicAction;
  success: boolean;
  result?: string;
  error?: string;
  payload?: unknown;
  timestamp: string;
}

// ── Monitor Events ────────────────────────────────────────────────────────────

export interface NewTopicEvent {
  type: 'new-topic';
  topic: TopicItem;
}

export interface DigestReadyEvent {
  type: 'digest-ready';
  digest: TopicDigest;
}

export interface MonitorErrorEvent {
  type: 'error';
  error: Error;
  source?: string;
}

export type TopicMonitorEvent =
  | NewTopicEvent
  | DigestReadyEvent
  | MonitorErrorEvent;

// ── Classification ───────────────────────────────────────────────────────────

export interface ClassifiedTopics {
  category: TopicCategory;
  topics: TopicItem[];
}

export interface ClassificationResult {
  groups: ClassifiedTopics[];
  unclassified: TopicItem[];
}

export interface ScoreWeights {
  recency: number;
  sourceAuthority: number;
  engagement: number;
  relevance: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  recency: 0.3,
  sourceAuthority: 0.25,
  engagement: 0.25,
  relevance: 0.2,
};

// ── Crawler ───────────────────────────────────────────────────────────────────

export interface CrawlResult {
  source: string;
  topics: TopicItem[];
  fetchedAt: string;
  error?: string;
}

export interface CrawlerOptions {
  timeout?: number;
  maxRetries?: number;
  userAgent?: string;
}
