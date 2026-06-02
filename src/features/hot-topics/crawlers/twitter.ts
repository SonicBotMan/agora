/**
 * Twitter/X crawler — skeleton for fetching trending topics.
 */

import type { CrawlResult, CrawlerOptions, TopicItem } from '../types';

export class TwitterCrawler {
  private options: Required<CrawlerOptions>;

  constructor(options: CrawlerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 10_000,
      maxRetries: options.maxRetries ?? 3,
      userAgent: options.userAgent ?? 'Agora-HotTopics/1.0',
    };
  }

  async fetch(_config?: Record<string, unknown>): Promise<CrawlResult> {
    const now = new Date().toISOString();

    try {
      // TODO: Replace with actual Twitter/X API v2 call
      // const bearerToken = config?.bearerToken as string;
      // const res = await fetch('https://api.twitter.com/2/tweets/search/recent?query=trending&max_results=10', {
      //   headers: { Authorization: `Bearer ${bearerToken}` },
      // });

      const topics: TopicItem[] = [];

      return {
        source: 'twitter',
        topics,
        fetchedAt: now,
      };
    } catch (err) {
      return {
        source: 'twitter',
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
