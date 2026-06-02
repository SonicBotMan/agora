/**
 * Custom RSS/API crawler — generic adapter for arbitrary sources.
 */

import type { CrawlResult, CrawlerOptions, TopicItem } from '../types';

export interface CustomCrawlerConfig {
  url: string;
  type: 'rss' | 'json-api' | 'html';
  titleSelector?: string;
  linkSelector?: string;
  itemSelector?: string;
  headers?: Record<string, string>;
}

export class CustomCrawler {
  private options: Required<CrawlerOptions>;

  constructor(options: CrawlerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 15_000,
      maxRetries: options.maxRetries ?? 3,
      userAgent: options.userAgent ?? 'Agora-HotTopics/1.0',
    };
  }

  async fetch(config?: Record<string, unknown>): Promise<CrawlResult> {
    const now = new Date().toISOString();

    try {
      const customConfig = config as unknown as CustomCrawlerConfig | undefined;
      if (!customConfig?.url) {
        return {
          source: 'custom',
          topics: [],
          fetchedAt: now,
          error: 'Custom crawler requires a URL in config',
        };
      }

      // TODO: Implement actual fetching based on type
      // - RSS: parse XML feed
      // - JSON-API: parse JSON response
      // - HTML: parse with cheerio and selectors

      const topics: TopicItem[] = [];

      return {
        source: 'custom',
        topics,
        fetchedAt: now,
      };
    } catch (err) {
      return {
        source: 'custom',
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
