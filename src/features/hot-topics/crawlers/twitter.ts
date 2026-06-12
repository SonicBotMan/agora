/**
 * Twitter/X crawler — configurable wrapper over the generic custom crawler.
 */

import type { CrawlerOptions,CrawlResult } from '../types';
import { CustomCrawler, type CustomCrawlerConfig } from './custom';

export type TwitterCrawlerConfig = Omit<CustomCrawlerConfig, 'source'>;

export class TwitterCrawler {
  private options: Required<CrawlerOptions>;
  private customCrawler: CustomCrawler;

  constructor(options: CrawlerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 10_000,
      maxRetries: options.maxRetries ?? 3,
      userAgent: options.userAgent ?? 'Agora-HotTopics/1.0',
    };
    this.customCrawler = new CustomCrawler(this.options);
  }

  async fetch(config?: Record<string, unknown>): Promise<CrawlResult> {
    const now = new Date().toISOString();
    const merged = this.buildConfig(config);

    try {
      if (!merged) {
        return {
          source: 'twitter',
          topics: [],
          fetchedAt: now,
          error: 'Twitter crawler requires a custom config with url and type',
        };
      }

      return await this.customCrawler.fetch(merged as unknown as Record<string, unknown>);
    } catch (err) {
      return {
        source: 'twitter',
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private buildConfig(config?: Record<string, unknown>): CustomCrawlerConfig | null {
    if (!config?.url || !config?.type) {
      return null;
    }

    return {
      ...(config as unknown as TwitterCrawlerConfig),
      source: 'twitter',
      category: (config.category as CustomCrawlerConfig['category'] | undefined) ?? 'social',
      tags: ['twitter', ...(((config.tags as string[] | undefined) ?? []))],
    };
  }
}
