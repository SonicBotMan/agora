/**
 * Agora — Hot Topics Types
 * Continuous topic monitoring and digest generation.
 */

export type TopicSource = 'hackernews' | 'twitter' | 'reddit' | 'arxiv' | 'weibo' | 'custom';

export interface TopicItem {
  id: string;
  title: string;
  summary: string;
  source: TopicSource;
  url: string;
  score: number;
  category: string;
  discoveredAt: string;
  tags: string[];
}

export interface TopicDigest {
  date: string;
  topics: TopicItem[];
  aiSummary?: string;
}

export interface SourceConfig {
  source: TopicSource;
  enabled: boolean;
  pollIntervalMinutes: number;
  categories?: string[];
  customUrl?: string;
}
