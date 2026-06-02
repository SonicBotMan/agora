/**
 * 微博爬虫 — skeleton for fetching hot topics from Weibo.
 */

import type { CrawlResult, CrawlerOptions, TopicItem } from '../types';

export class WeiboCrawler {
  private options: Required<CrawlerOptions>;

  constructor(options: CrawlerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 10_000,
      maxRetries: options.maxRetries ?? 3,
      userAgent: options.userAgent ?? 'Agora-HotTopics/1.0',
    };
  }

  async fetch(config?: Record<string, unknown>): Promise<CrawlResult> {
    const now = new Date().toISOString();

    try {
      // TODO: Replace with actual Weibo API or scraping logic
      // const cookie = config?.cookie as string;
      // const res = await fetch('https://weibo.com/ajax/side/hotSearch', {
      //   headers: { Cookie: cookie },
      // });

      const topics: TopicItem[] = [];

      return {
        source: 'weibo',
        topics,
        fetchedAt: now,
      };
    } catch (err) {
      return {
        source: 'weibo',
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
