/**
 * Reddit crawler — fetches trending posts from configured subreddits.
 */

import type { CrawlerOptions, CrawlResult, TopicItem } from '../types';

const DEFAULT_SUBREDDITS = [
  'technology',
  'programming',
  'MachineLearning',
  'science',
  'worldnews',
];

const DEFAULT_LIMIT_PER_SUBREDDIT = 15;
const DEFAULT_MAX_ITEMS = 50;

interface NormalizedRedditCrawlerConfig {
  subreddits: string[];
  sort: 'hot' | 'top' | 'new' | 'rising';
  timeRange: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limitPerSubreddit: number;
  maxItems: number;
  includeNsfw: boolean;
  includeStickied: boolean;
  minScore: number;
}

export class RedditCrawler {
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
    const normalizedConfig = this.normalizeConfig(config);

    try {
      const subredditResults = await Promise.allSettled(
        normalizedConfig.subreddits.map(async (subreddit) => ({
          subreddit,
          posts: await this.fetchSubredditPosts(subreddit, normalizedConfig),
        })),
      );

      const topics = new Map<string, TopicItem>();
      const errors: string[] = [];

      for (const result of subredditResults) {
        if (result.status === 'rejected') {
          errors.push(
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          );
          continue;
        }

        for (const post of result.value.posts) {
          if (!this.shouldIncludePost(post, normalizedConfig)) {
            continue;
          }

          const topic = this.toTopicItem(post, result.value.subreddit, now);
          const existing = topics.get(topic.id);
          if (!existing || this.shouldReplaceTopic(existing, topic)) {
            topics.set(topic.id, topic);
          }

          if (topics.size >= normalizedConfig.maxItems) {
            break;
          }
        }

        if (topics.size >= normalizedConfig.maxItems) {
          break;
        }
      }

      const orderedTopics = Array.from(topics.values()).sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return (
          new Date(right.discoveredAt).getTime() -
          new Date(left.discoveredAt).getTime()
        );
      });

      return {
        source: 'reddit',
        topics: orderedTopics,
        fetchedAt: now,
        error: orderedTopics.length === 0 && errors.length > 0
          ? errors.join('; ')
          : undefined,
      };
    } catch (err) {
      return {
        source: 'reddit',
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private normalizeConfig(config?: Record<string, unknown>): NormalizedRedditCrawlerConfig {
    const requestedSubreddits = Array.isArray(config?.subreddits)
      ? config.subreddits.filter((value): value is string => typeof value === 'string')
      : [];

    return {
      subreddits: requestedSubreddits.length > 0
        ? requestedSubreddits
        : DEFAULT_SUBREDDITS,
      sort: this.normalizeSort(config?.sort),
      timeRange: this.normalizeTimeRange(config?.timeRange),
      limitPerSubreddit: this.normalizePositiveInteger(
        config?.limitPerSubreddit,
        DEFAULT_LIMIT_PER_SUBREDDIT,
        100,
      ),
      maxItems: this.normalizePositiveInteger(
        config?.maxItems,
        DEFAULT_MAX_ITEMS,
        200,
      ),
      includeNsfw: config?.includeNsfw === true,
      includeStickied: config?.includeStickied === true,
      minScore: typeof config?.minScore === 'number'
        ? Math.max(0, Math.floor(config.minScore))
        : 0,
    };
  }

  private normalizeSort(value: unknown): NormalizedRedditCrawlerConfig['sort'] {
    switch (value) {
      case 'top':
      case 'new':
      case 'rising':
      case 'hot':
        return value;
      default:
        return 'hot';
    }
  }

  private normalizeTimeRange(value: unknown): NormalizedRedditCrawlerConfig['timeRange'] {
    switch (value) {
      case 'hour':
      case 'day':
      case 'week':
      case 'month':
      case 'year':
      case 'all':
        return value;
      default:
        return 'day';
    }
  }

  private normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(1, Math.min(max, Math.floor(value)));
  }

  private async fetchSubredditPosts(
    subreddit: string,
    config: NormalizedRedditCrawlerConfig,
  ): Promise<RedditPost[]> {
    const url = this.buildSubredditUrl(subreddit, config);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(this.options.timeout),
          headers: {
            'User-Agent': this.options.userAgent,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error(`Reddit API returned ${res.status} for r/${subreddit}`);
        }

        const json = await res.json() as RedditResponse;
        return json.data?.children?.map((child) => child.data) ?? [];
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === this.options.maxRetries) {
          break;
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch r/${subreddit}`);
  }

  private buildSubredditUrl(
    subreddit: string,
    config: NormalizedRedditCrawlerConfig,
  ): string {
    const url = new URL(`https://www.reddit.com/r/${subreddit}/${config.sort}.json`);
    url.searchParams.set('limit', String(config.limitPerSubreddit));
    url.searchParams.set('raw_json', '1');

    if (config.sort === 'top') {
      url.searchParams.set('t', config.timeRange);
    }

    return url.toString();
  }

  private shouldIncludePost(
    post: RedditPost,
    config: NormalizedRedditCrawlerConfig,
  ): boolean {
    if (!post.id || !post.title || !post.permalink) {
      return false;
    }
    if (!config.includeStickied && post.stickied) {
      return false;
    }
    if (!config.includeNsfw && post.over_18) {
      return false;
    }
    if ((post.score ?? 0) < config.minScore) {
      return false;
    }
    return true;
  }

  private shouldReplaceTopic(existing: TopicItem, candidate: TopicItem): boolean {
    if (candidate.score !== existing.score) {
      return candidate.score > existing.score;
    }
    return (
      new Date(candidate.discoveredAt).getTime() >
      new Date(existing.discoveredAt).getTime()
    );
  }

  private toTopicItem(
    post: RedditPost,
    fallbackSubreddit: string,
    fallbackDiscoveredAt: string,
  ): TopicItem {
    const subreddit = post.subreddit || fallbackSubreddit;
    const title = this.normalizeWhitespace(post.title);
    const flair = this.normalizeWhitespace(post.link_flair_text ?? '');
    const summary = this.buildSummary(post, title, flair);
    const discoveredAt = post.created_utc
      ? new Date(post.created_utc * 1000).toISOString()
      : fallbackDiscoveredAt;

    return {
      id: `reddit-${post.id}`,
      title,
      summary,
      source: 'reddit',
      url: this.resolveTopicUrl(post),
      score: post.score ?? post.ups ?? 0,
      category: this.guessCategory(title, subreddit, flair),
      discoveredAt,
      tags: this.buildTags(title, subreddit, flair),
    };
  }

  private resolveTopicUrl(post: RedditPost): string {
    const candidate = post.url_overridden_by_dest || post.url;
    if (candidate && this.isExternalUrl(candidate)) {
      return candidate;
    }
    return `https://reddit.com${post.permalink}`;
  }

  private isExternalUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return !url.hostname.endsWith('reddit.com');
    } catch {
      return false;
    }
  }

  private buildSummary(post: RedditPost, title: string, flair: string): string {
    const selftext = this.normalizeWhitespace(
      (post.selftext ?? '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>'),
    );

    if (selftext) {
      return selftext.slice(0, 220);
    }

    if (flair) {
      return `${flair}: ${title}`.slice(0, 220);
    }

    const externalUrl = post.url_overridden_by_dest || post.url;
    if (externalUrl && this.isExternalUrl(externalUrl)) {
      const hostname = this.extractHostname(externalUrl);
      return `Shared from ${hostname}: ${title}`.slice(0, 220);
    }

    return title.slice(0, 220);
  }

  private extractHostname(value: string): string {
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return 'external link';
    }
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private guessCategory(
    title: string,
    subreddit: string,
    flair: string,
  ): TopicItem['category'] {
    const text = `${title} ${subreddit} ${flair}`.toLowerCase();

    if (/ai|llm|gpt|machine learning|deep learning|neural|model/i.test(text)) return 'ai';
    if (/science|space|physics|biology|chemistry|research/i.test(text)) return 'science';
    if (/crypto|bitcoin|stock|market|invest|finance/i.test(text)) return 'finance';
    if (/politic|government|election|policy|worldnews/i.test(text)) return 'politics';
    if (/health|medical|covid|disease|drug|clinical/i.test(text)) return 'health';
    if (/music|movie|film|tv|gaming|entertainment/i.test(text)) return 'entertainment';
    if (/education|learning resource|course|curriculum/i.test(text)) return 'education';
    if (/community|society|culture|social/i.test(text)) return 'social';
    if (/programming|technology|opensource|open source|webdev|devops/i.test(text)) return 'tech';

    return 'tech';
  }

  private buildTags(title: string, subreddit: string, flair: string): string[] {
    const tags = new Set<string>();
    const normalizedSubreddit = subreddit.toLowerCase();
    tags.add('reddit');
    tags.add(normalizedSubreddit);

    if (flair) {
      tags.add(this.normalizeTag(flair));
    }

    const candidates = [
      'ai',
      'llm',
      'gpt',
      'open-source',
      'startup',
      'rust',
      'python',
      'go',
      'typescript',
      'javascript',
      'react',
      'docker',
      'kubernetes',
      'security',
      'policy',
      'research',
      'benchmark',
    ];
    const normalizedTitle = title.toLowerCase();
    for (const candidate of candidates) {
      const matcher = candidate.includes('-')
        ? candidate.replace('-', '[ -]?')
        : candidate;
      if (new RegExp(`\\b${matcher}\\b`, 'i').test(normalizedTitle)) {
        tags.add(candidate);
      }
    }

    return Array.from(tags).filter(Boolean);
  }

  private normalizeTag(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  permalink: string;
  score?: number;
  ups?: number;
  created_utc?: number;
  subreddit: string;
  url?: string;
  url_overridden_by_dest?: string;
  over_18?: boolean;
  stickied?: boolean;
  link_flair_text?: string;
}

interface RedditChild {
  data: RedditPost;
}

interface RedditListingData {
  children?: RedditChild[];
}

interface RedditResponse {
  data?: RedditListingData;
}
