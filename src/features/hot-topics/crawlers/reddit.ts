/**
 * Reddit crawler — skeleton for fetching hot posts from subreddits.
 */

import type { CrawlResult, CrawlerOptions, TopicItem } from '../types';

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

    try {
      const subreddits = (config?.subreddits as string[]) ?? ['technology', 'programming', 'MachineLearning', 'science', 'worldnews'];
      const topics: TopicItem[] = [];

      for (const sub of subreddits) {
        const posts = await this.fetchSubredditHot(sub);
        for (const post of posts) {
          topics.push({
            id: `reddit-${post.id}`,
            title: post.title,
            summary: post.selftext?.slice(0, 200) ?? post.title,
            source: 'reddit',
            url: `https://reddit.com${post.permalink}`,
            score: post.score ?? 0,
            category: this.guessCategory(post.title, sub),
            discoveredAt: new Date((post.created_utc ?? 0) * 1000).toISOString(),
            tags: ['reddit', sub, ...this.extractTags(post.title)],
          });
        }
      }

      return {
        source: 'reddit',
        topics,
        fetchedAt: now,
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

  private async fetchSubredditHot(subreddit: string): Promise<RedditPost[]> {
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=15`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(this.options.timeout),
      headers: { 'User-Agent': this.options.userAgent },
    });

    if (!res.ok) return [];

    const json = await res.json() as RedditResponse;
    return json.data?.children?.map(c => c.data) ?? [];
  }

  private guessCategory(title: string, subreddit: string): TopicItem['category'] {
    const t = title.toLowerCase();
    if (/ai|llm|gpt|machine learning/i.test(t)) return 'ai';
    if (/science|space|physics/i.test(t)) return 'science';
    if (/crypto|bitcoin|market|invest/i.test(t)) return 'finance';
    if (/politic|government|election/i.test(t)) return 'politics';
    if (/health|covid|medical/i.test(t)) return 'health';
    if (subreddit === 'MachineLearning' || subreddit === 'programming') return 'tech';
    return 'tech';
  }

  private extractTags(title: string): string[] {
    const tags: string[] = [];
    const t = title.toLowerCase();
    const langs = ['rust', 'python', 'go', 'typescript', 'javascript', 'react', 'kubernetes', 'docker'];
    for (const lang of langs) {
      if (t.includes(lang)) tags.push(lang);
    }
    return tags;
  }
}

// ── Raw Reddit API shape ────────────────────────────────────────────────────

interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  permalink: string;
  score?: number;
  created_utc?: number;
  subreddit: string;
  url?: string;
}

interface RedditChild {
  data: RedditPost;
}

interface RedditListingData {
  children: RedditChild[];
}

interface RedditResponse {
  data: RedditListingData;
}
