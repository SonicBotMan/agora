/**
 * Unified crawler interface and factory.
 */

import type { CrawlResult, CrawlerOptions, SourceConfig } from '../types';
import { HackerNewsCrawler } from './hackernews';
import { TwitterCrawler } from './twitter';
import { RedditCrawler } from './reddit';
import { ArxivCrawler } from './arxiv';
import { WeiboCrawler } from './weibo';
import { CustomCrawler } from './custom';

// ── Crawler Adapter Interface ────────────────────────────────────────────────

export interface CrawlerAdapter {
  fetch(config?: Record<string, unknown>): Promise<CrawlResult>;
}

// ── Crawler Factory ──────────────────────────────────────────────────────────

export class CrawlerFactory {
  private static registry: Map<string, new (options: CrawlerOptions) => CrawlerAdapter> = new Map([
    ['hacker-news', HackerNewsCrawler as unknown as new (options: CrawlerOptions) => CrawlerAdapter],
    ['twitter', TwitterCrawler as unknown as new (options: CrawlerOptions) => CrawlerAdapter],
    ['reddit', RedditCrawler as unknown as new (options: CrawlerOptions) => CrawlerAdapter],
    ['arxiv', ArxivCrawler as unknown as new (options: CrawlerOptions) => CrawlerAdapter],
    ['weibo', WeiboCrawler as unknown as new (options: CrawlerOptions) => CrawlerAdapter],
    ['custom', CustomCrawler as unknown as new (options: CrawlerOptions) => CrawlerAdapter],
  ]);

  /**
   * Register a custom crawler class for a source name.
   */
  static register(source: string, ctor: new (options: CrawlerOptions) => CrawlerAdapter): void {
    this.registry.set(source, ctor);
  }

  /**
   * Create a crawler instance for the given source.
   *
   * Throws if no crawler is registered for the source.
   */
  static create(source: string, options?: CrawlerOptions): CrawlerAdapter {
    const Ctor = this.registry.get(source);
    if (!Ctor) {
      throw new Error(`No crawler registered for source: "${source}". Available sources: ${Array.from(this.registry.keys()).join(', ')}`);
    }
    return new Ctor(options ?? {});
  }

  /**
   * List all registered source names.
   */
  static available(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Convenience: create crawlers for a list of source configs.
   */
  static createAll(configs: SourceConfig[], options?: CrawlerOptions): Map<string, CrawlerAdapter> {
    const map = new Map<string, CrawlerAdapter>();
    for (const cfg of configs) {
      if (cfg.enabled) {
        map.set(cfg.source, this.create(cfg.source, options));
      }
    }
    return map;
  }
}

// ── Re-export crawler classes ────────────────────────────────────────────────

export { HackerNewsCrawler } from './hackernews';
export { TwitterCrawler } from './twitter';
export { RedditCrawler } from './reddit';
export { ArxivCrawler } from './arxiv';
export { WeiboCrawler } from './weibo';
export { CustomCrawler } from './custom';
export type { CustomCrawlerConfig } from './custom';
