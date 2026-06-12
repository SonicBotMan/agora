/**
 * Custom RSS/API crawler — generic adapter for arbitrary sources.
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

import type { CrawlerOptions, CrawlResult, TopicItem } from '../types';

type CustomCrawlerType = 'rss' | 'json-api' | 'html';

export interface CustomCrawlerConfig {
  url: string;
  type: CustomCrawlerType;
  source?: string;
  category?: TopicItem['category'];
  tags?: string[];
  limit?: number;
  itemPath?: string;
  titleField?: string;
  summaryField?: string;
  linkField?: string;
  scoreField?: string;
  dateField?: string;
  tagsField?: string;
  titleSelector?: string;
  summarySelector?: string;
  linkSelector?: string;
  itemSelector?: string;
  scoreSelector?: string;
  dateSelector?: string;
  tagsSelector?: string;
  itemAttribute?: string;
  titleAttribute?: string;
  summaryAttribute?: string;
  linkAttribute?: string;
  scoreAttribute?: string;
  dateAttribute?: string;
  tagsAttribute?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

interface CustomFetchContext {
  config: CustomCrawlerConfig;
  source: string;
  category: TopicItem['category'];
  baseTags: string[];
  fetchedAt: string;
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
    const customConfig = config as unknown as CustomCrawlerConfig | undefined;
    const source = customConfig?.source?.trim() || 'custom';

    try {
      if (!customConfig?.url) {
        return {
          source,
          topics: [],
          fetchedAt: now,
          error: 'Custom crawler requires a URL in config',
        };
      }

      const context: CustomFetchContext = {
        config: customConfig,
        source,
        category: customConfig.category ?? 'other',
        baseTags: this.normalizeTags([source, ...(customConfig.tags ?? [])]),
        fetchedAt: now,
      };

      const topics = await this.fetchTopics(context);

      return {
        source,
        topics,
        fetchedAt: now,
      };
    } catch (err) {
      return {
        source,
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async fetchTopics(context: CustomFetchContext): Promise<TopicItem[]> {
    switch (context.config.type) {
      case 'rss':
        return this.fetchRss(context);
      case 'json-api':
        return this.fetchJsonApi(context);
      case 'html':
        return this.fetchHtml(context);
      default:
        throw new Error(`Unsupported custom crawler type: ${(context.config as { type?: string }).type ?? 'unknown'}`);
    }
  }

  private async fetchRss(context: CustomFetchContext): Promise<TopicItem[]> {
    const xml = await this.fetchText(context.config.url, context.config.headers);
    const $ = cheerio.load(xml, { xmlMode: true });
    const itemNodes = $('item').toArray();
    const entryNodes = itemNodes.length > 0 ? itemNodes : $('entry').toArray();
    const limit = this.resolveLimit(context.config.limit, 20);

    return entryNodes.slice(0, limit).map((node, index) => {
      const item = $(node);
      const title = this.readXmlNode($, item, ['title']) || `Untitled ${index + 1}`;
      const summary = this.readXmlNode($, item, ['description', 'summary', 'content']) || title;
      const rawLink = this.readRssLink(item);
      const discoveredAt = this.normalizeDate(
        this.readXmlNode($, item, ['pubDate', 'published', 'updated', 'dc:date']),
        context.fetchedAt,
      );
      const tags = this.normalizeTags([
        ...context.baseTags,
        ...this.readXmlTags($, item),
        ...this.extractKeywordTags(`${title} ${summary}`),
      ]);
      const score = this.inferScore(summary.length, tags.length);

      return this.createTopic({
        context,
        index,
        title,
        summary,
        url: this.resolveUrl(rawLink, context.config.baseUrl ?? context.config.url),
        discoveredAt,
        score,
        tags,
      });
    });
  }

  private async fetchJsonApi(context: CustomFetchContext): Promise<TopicItem[]> {
    const payload = await this.fetchJson(context.config.url, context.config.headers);
    const items = this.resolveJsonArray(payload, context.config.itemPath);
    const limit = this.resolveLimit(context.config.limit, 20);

    return items.slice(0, limit).map((entry, index) => {
      const title = this.readJsonString(entry, context.config.titleField ?? 'title') || `Untitled ${index + 1}`;
      const summary = this.readJsonString(entry, context.config.summaryField ?? 'summary')
        || this.readJsonString(entry, 'description')
        || title;
      const rawLink = this.readJsonString(entry, context.config.linkField ?? 'url');
      const discoveredAt = this.normalizeDate(
        this.readJsonString(entry, context.config.dateField ?? 'publishedAt')
          || this.readJsonString(entry, 'createdAt')
          || this.readJsonString(entry, 'date'),
        context.fetchedAt,
      );
      const score = this.normalizeScore(
        this.readJsonNumber(entry, context.config.scoreField ?? 'score')
          ?? this.readJsonNumber(entry, 'likes')
          ?? this.readJsonNumber(entry, 'points')
          ?? this.readJsonNumber(entry, 'rank'),
      );
      const jsonTags = this.readJsonTags(entry, context.config.tagsField ?? 'tags');
      const tags = this.normalizeTags([
        ...context.baseTags,
        ...jsonTags,
        ...this.extractKeywordTags(`${title} ${summary}`),
      ]);

      return this.createTopic({
        context,
        index,
        title,
        summary,
        url: this.resolveUrl(rawLink, context.config.baseUrl ?? context.config.url),
        discoveredAt,
        score: score ?? this.inferScore(summary.length, tags.length),
        tags,
      });
    });
  }

  private async fetchHtml(context: CustomFetchContext): Promise<TopicItem[]> {
    const html = await this.fetchText(context.config.url, context.config.headers);
    const $ = cheerio.load(html);
    const itemSelector = context.config.itemSelector?.trim();
    if (!itemSelector) {
      throw new Error('HTML custom crawler requires itemSelector');
    }

    const nodes = $(itemSelector).toArray();
    const limit = this.resolveLimit(context.config.limit, 20);

    return nodes.slice(0, limit).map((node, index) => {
      const item = $(node);
      const title = this.readHtmlValue(item, context.config.titleSelector, context.config.titleAttribute)
        || this.readHtmlValue(item, 'a', 'title')
        || this.readHtmlValue(item, 'a')
        || `Untitled ${index + 1}`;
      const summary = this.readHtmlValue(item, context.config.summarySelector, context.config.summaryAttribute)
        || this.readHtmlValue(item, 'p')
        || title;
      const rawLink = this.readHtmlValue(item, context.config.linkSelector, context.config.linkAttribute ?? 'href')
        || this.readHtmlValue(item, 'a', 'href');
      const discoveredAt = this.normalizeDate(
        this.readHtmlValue(item, context.config.dateSelector, context.config.dateAttribute),
        context.fetchedAt,
      );
      const tags = this.normalizeTags([
        ...context.baseTags,
        ...this.parseDelimitedTags(
          this.readHtmlValue(item, context.config.tagsSelector, context.config.tagsAttribute),
        ),
        ...this.extractKeywordTags(`${title} ${summary}`),
      ]);
      const score = this.normalizeScore(
        this.parseLooseNumber(this.readHtmlValue(item, context.config.scoreSelector, context.config.scoreAttribute)),
      ) ?? this.inferScore(summary.length, tags.length);

      return this.createTopic({
        context,
        index,
        title,
        summary,
        url: this.resolveUrl(rawLink, context.config.baseUrl ?? context.config.url),
        discoveredAt,
        score,
        tags,
      });
    });
  }

  private async fetchText(url: string, headers?: Record<string, string>): Promise<string> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.options.timeout),
      headers: {
        'User-Agent': this.options.userAgent,
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Custom crawler request failed with status ${response.status}`);
    }

    return response.text();
  }

  private async fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.options.timeout),
      headers: {
        Accept: 'application/json',
        'User-Agent': this.options.userAgent,
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Custom crawler request failed with status ${response.status}`);
    }

    return response.json() as Promise<unknown>;
  }

  private resolveJsonArray(payload: unknown, path?: string): Array<Record<string, unknown>> {
    const candidate = path ? this.getByPath(payload, path) : payload;

    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }

    if (candidate && typeof candidate === 'object') {
      const items = (candidate as { items?: unknown }).items;
      if (Array.isArray(items)) {
        return items.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
      }
    }

    return [];
  }

  private getByPath(value: unknown, path: string): unknown {
    return path
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .reduce<unknown>((current, segment) => {
        if (current == null) {
          return undefined;
        }
        if (Array.isArray(current)) {
          const index = Number(segment);
          return Number.isInteger(index) ? current[index] : undefined;
        }
        if (typeof current === 'object') {
          return (current as Record<string, unknown>)[segment];
        }
        return undefined;
      }, value);
  }

  private readJsonString(entry: Record<string, unknown>, path: string): string | null {
    const value = this.getByPath(entry, path);
    if (typeof value === 'string') {
      return value.trim() || null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return null;
  }

  private readJsonNumber(entry: Record<string, unknown>, path: string): number | null {
    const value = this.getByPath(entry, path);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return this.parseLooseNumber(value);
    }
    return null;
  }

  private readJsonTags(entry: Record<string, unknown>, path: string): string[] {
    const value = this.getByPath(entry, path);
    if (Array.isArray(value)) {
      return value
        .map((tag) => (typeof tag === 'string' ? tag : typeof tag === 'number' ? String(tag) : null))
        .filter((tag): tag is string => Boolean(tag));
    }
    if (typeof value === 'string') {
      return this.parseDelimitedTags(value);
    }
    return [];
  }

  private readXmlNode(
    $: cheerio.CheerioAPI,
    node: cheerio.Cheerio<AnyNode>,
    selectors: string[],
  ): string | null {
    for (const selector of selectors) {
      let value: string | null = null;

      node.children().each((_index, element) => {
        const tagName = (
          (element as { tagName?: string; name?: string }).tagName
          ?? (element as { name?: string }).name
          ?? ''
        ).toLowerCase();

        if (tagName === selector.toLowerCase()) {
          const text = $(element).text().trim();
          if (text) {
            value = text;
          }
          return false;
        }

        return undefined;
      });

      if (value) {
        return value;
      }
    }
    return null;
  }

  private readRssLink(node: cheerio.Cheerio<AnyNode>): string {
    const atomHref = node.children('link').attr('href');
    if (atomHref?.trim()) {
      return atomHref.trim();
    }

    const linkText = node.children('link').first().text().trim();
    return linkText || '';
  }

  private readXmlTags(
    $: cheerio.CheerioAPI,
    node: cheerio.Cheerio<AnyNode>,
  ): string[] {
    const tags = new Set<string>();
    node.children('category').each((_index, element) => {
      const item = $(element);
      const text = item.text().trim();
      if (text) {
        tags.add(text);
      }
      const term = item.attr('term')?.trim();
      if (term) {
        tags.add(term);
      }
    });
    return Array.from(tags);
  }

  private readHtmlValue(
    node: cheerio.Cheerio<AnyNode>,
    selector?: string,
    attribute?: string,
  ): string | null {
    if (!selector) {
      return null;
    }

    const target = node.is(selector) ? node.first() : node.find(selector).first();
    if (target.length === 0) {
      return null;
    }

    const value = attribute ? target.attr(attribute) : target.text();
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private parseDelimitedTags(value?: string | null): string[] {
    if (!value) {
      return [];
    }
    return value
      .split(/[,\n/|]+/g)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  private extractKeywordTags(text: string): string[] {
    const normalized = text.toLowerCase();
    const compact = normalized.replace(/[\s_-]+/g, '');
    const matchers: Array<{ tag: string; test: (value: string, collapsed: string) => boolean }> = [
      { tag: 'ai', test: (value) => /\bai\b/.test(value) },
      { tag: 'llm', test: (value) => /\bllm\b/.test(value) },
      { tag: 'gpt', test: (value) => /\bgpt\b/.test(value) },
      { tag: 'open-source', test: (value, collapsed) => value.includes('open source') || value.includes('open-source') || collapsed.includes('opensource') },
      { tag: 'security', test: (value) => value.includes('security') || value.includes('cyber') },
      { tag: 'robotics', test: (value) => value.includes('robotics') || value.includes('robot') },
      { tag: 'startup', test: (value) => value.includes('startup') || value.includes('funding') },
      { tag: 'finance', test: (value) => value.includes('finance') || value.includes('market') },
      { tag: 'policy', test: (value) => value.includes('policy') || value.includes('regulation') },
      { tag: 'science', test: (value) => value.includes('science') || value.includes('research') },
      { tag: 'python', test: (value) => value.includes('python') },
      { tag: 'typescript', test: (value) => value.includes('typescript') },
      { tag: 'rust', test: (value) => value.includes('rust') },
    ];

    return matchers
      .filter((matcher) => matcher.test(normalized, compact))
      .map((matcher) => matcher.tag);
  }

  private normalizeTags(tags: string[]): string[] {
    const result = new Set<string>();

    for (const tag of tags) {
      const normalized = tag.trim().toLowerCase().replace(/\s+/g, '-');
      if (normalized) {
        result.add(normalized);
      }
    }

    return Array.from(result);
  }

  private inferScore(summaryLength: number, tagCount: number): number {
    return Math.min(85, Math.max(25, 35 + Math.round(summaryLength / 12) + tagCount * 4));
  }

  private normalizeScore(value: number | null): number | null {
    if (value == null || Number.isNaN(value)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private parseLooseNumber(value: string | null): number | null {
    if (!value) {
      return null;
    }
    const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  private normalizeDate(value: string | null, fallback: string): string {
    if (!value) {
      return fallback;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }

  private resolveUrl(rawUrl: string | null, baseUrl: string): string {
    if (!rawUrl) {
      return baseUrl;
    }

    try {
      return new URL(rawUrl, baseUrl).toString();
    } catch {
      return rawUrl;
    }
  }

  private resolveLimit(value: number | undefined, fallback: number): number {
    if (!value || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(1, Math.floor(value));
  }

  private createTopic(input: {
    context: CustomFetchContext;
    index: number;
    title: string;
    summary: string;
    url: string;
    discoveredAt: string;
    score: number;
    tags: string[];
  }): TopicItem {
    const slug = this.slugify(input.title) || `item-${input.index + 1}`;

    return {
      id: `${input.context.source}-${slug}-${input.index + 1}`,
      title: input.title.trim(),
      summary: input.summary.trim(),
      source: input.context.source,
      url: input.url,
      score: input.score,
      category: input.context.category,
      discoveredAt: input.discoveredAt,
      tags: input.tags,
    };
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }
}
