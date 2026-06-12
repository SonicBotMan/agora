/**
 * 微博爬虫 — 基于通用抓取器的可配置封装。
 */

import type { CrawlerOptions,CrawlResult } from '../types';
import { CustomCrawler, type CustomCrawlerConfig } from './custom';

export type WeiboCrawlerConfig = Omit<CustomCrawlerConfig, 'source'>;

export class WeiboCrawler {
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
          source: 'weibo',
          topics: [],
          fetchedAt: now,
          error: 'Weibo crawler requires a custom config with url and type',
        };
      }

      return await this.customCrawler.fetch(merged as unknown as Record<string, unknown>);
    } catch (err) {
      return {
        source: 'weibo',
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
      ...(config as unknown as WeiboCrawlerConfig),
      source: 'weibo',
      category: (config.category as CustomCrawlerConfig['category'] | undefined) ?? 'social',
      tags: ['weibo', ...(((config.tags as string[] | undefined) ?? []))],
    };
  }
}
