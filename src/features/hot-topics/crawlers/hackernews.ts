/**
 * Hacker News crawler — fetches top stories from the HN API.
 */

import type { CrawlerOptions, CrawlResult, TopicItem } from '../types';

const HN_TOP_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM_URL = 'https://hacker-news.firebaseio.com/v0/item';

export class HackerNewsCrawler {
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
      const ids = await this.fetchTopStoryIds();
      const storyPromises = ids.slice(0, 30).map(id => this.fetchItem(id));
      const stories = await Promise.all(storyPromises);

      const topics: TopicItem[] = stories
        .filter((s): s is HackerNewsStory => s !== null && s.type === 'story' && s.title != null)
        .map((s) => ({
          id: `hn-${s.id}`,
          title: s.title,
          summary: s.text?.slice(0, 200) ?? s.title,
          source: 'hacker-news',
          url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
          score: s.score ?? 0,
          category: this.guessCategory(s.title),
          discoveredAt: new Date((s.time ?? 0) * 1000).toISOString(),
          tags: ['hacker-news', ...this.extractTags(s.title)],
        }));

      return {
        source: 'hacker-news',
        topics,
        fetchedAt: now,
      };
    } catch (err) {
      return {
        source: 'hacker-news',
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async fetchTopStoryIds(): Promise<number[]> {
    const res = await fetch(HN_TOP_STORIES_URL, {
      signal: AbortSignal.timeout(this.options.timeout),
      headers: { 'User-Agent': this.options.userAgent },
    });

    if (!res.ok) {
      throw new Error(`HN API returned ${res.status}`);
    }

    return res.json() as Promise<number[]>;
  }

  private async fetchItem(id: number): Promise<HackerNewsStory | null> {
    try {
      const res = await fetch(`${HN_ITEM_URL}/${id}.json`, {
        signal: AbortSignal.timeout(this.options.timeout),
        headers: { 'User-Agent': this.options.userAgent },
      });

      if (!res.ok) return null;

      return res.json() as Promise<HackerNewsStory>;
    } catch {
      return null;
    }
  }

  private guessCategory(title: string): TopicItem['category'] {
    const t = title.toLowerCase();
    if (/ai|llm|gpt|machine learning|deep learning|neural/i.test(t)) return 'ai';
    if (/science|space|physics|biology|chemistry|nasa/i.test(t)) return 'science';
    if (/finance|stock|crypto|bitcoin|market|invest/i.test(t)) return 'finance';
    if (/health|covid|medical|drug|disease/i.test(t)) return 'health';
    if (/security|cyber|hack|breach/i.test(t)) return 'tech';
    return 'tech';
  }

  private extractTags(title: string): string[] {
    const tags: string[] = [];
    const t = title.toLowerCase();
    if (/open.?source/i.test(t)) tags.push('open-source');
    if (/startup|founder|series [a-z]/i.test(t)) tags.push('startup');
    if (/rust|python|go|typescript|javascript|react/i.test(t)) tags.push(t.match(/(rust|python|go|typescript|javascript|react)/i)![1].toLowerCase());
    return tags;
  }
}

// ── Raw HN API shape ────────────────────────────────────────────────────────

interface HackerNewsStory {
  id: number;
  type: string;
  title: string;
  url?: string;
  text?: string;
  score?: number;
  time?: number;
  by?: string;
  descendants?: number;
}
