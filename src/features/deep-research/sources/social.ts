import type { Finding, Source } from '../types';
import type { SearchResult, SearchSourceAdapter } from './index';

export class SocialSearchAdapter implements SearchSourceAdapter {
  readonly sourceType = 'social' as const;

  async search(query: string, limit = 10): Promise<SearchResult> {
    const boundedLimit = Math.max(1, Math.min(limit, 20));
    const perSourceLimit = Math.max(1, Math.min(boundedLimit, 10));

    const results = await Promise.allSettled([
      this.searchReddit(query, perSourceLimit),
      this.searchHackerNews(query, perSourceLimit),
    ]);

    const dedupedFindings = new Map<string, Finding>();

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        continue;
      }

      for (const finding of result.value) {
        const key = this.normalizeFindingKey(finding.url);
        const existing = dedupedFindings.get(key);
        if (!existing || existing.relevanceScore < finding.relevanceScore) {
          dedupedFindings.set(key, finding);
        }
      }
    }

    const findings = Array.from(dedupedFindings.values())
      .sort((left, right) => {
        if (right.relevanceScore !== left.relevanceScore) {
          return right.relevanceScore - left.relevanceScore;
        }
        return right.source.retrievedAt.localeCompare(left.source.retrievedAt);
      })
      .slice(0, boundedLimit);

    return {
      findings,
      sourceMetadata: findings.map((finding) => finding.source),
    };
  }

  private async searchReddit(query: string, limit: number): Promise<Finding[]> {
    const endpoint = new URL('https://www.reddit.com/search.json');
    endpoint.searchParams.set('q', query);
    endpoint.searchParams.set('sort', 'top');
    endpoint.searchParams.set('t', 'month');
    endpoint.searchParams.set('limit', String(limit));
    endpoint.searchParams.set('raw_json', '1');

    try {
      const response = await fetch(endpoint, {
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Reddit search failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as RedditSearchResponse;
      const children = data.data?.children ?? [];

      return children
        .map((item, index) => this.toRedditFinding(item.data, index))
        .filter((finding): finding is Finding => Boolean(finding));
    } catch (error) {
      console.warn(
        `[SocialSearchAdapter] Reddit search failed for "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private async searchHackerNews(query: string, limit: number): Promise<Finding[]> {
    const endpoint = new URL('https://hn.algolia.com/api/v1/search');
    endpoint.searchParams.set('query', query);
    endpoint.searchParams.set('tags', 'story');
    endpoint.searchParams.set('hitsPerPage', String(limit));

    try {
      const response = await fetch(endpoint, {
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Hacker News search failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as HackerNewsSearchResponse;

      return (data.hits ?? [])
        .map((item, index) => this.toHackerNewsFinding(item, index))
        .filter((finding): finding is Finding => Boolean(finding));
    } catch (error) {
      console.warn(
        `[SocialSearchAdapter] Hacker News search failed for "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private toRedditFinding(
    item: RedditPost | undefined,
    index: number,
  ): Finding | null {
    if (!item?.title || !item.permalink) {
      return null;
    }

    const discussionUrl = `https://www.reddit.com${item.permalink}`;
    const url = normalizeExternalUrl(item.url) ?? discussionUrl;
    const subreddit = item.subreddit ? `r/${item.subreddit}` : 'Reddit';
    const source = this.createSource(
      url,
      `[Reddit] ${subreddit} - ${item.title}`,
      item.created_utc
        ? new Date(item.created_utc * 1000).toISOString()
        : new Date().toISOString(),
    );

    const stats = `${subreddit} • ${item.ups ?? 0} upvotes • ${item.num_comments ?? 0} comments`;
    const body = cleanSnippet(item.selftext ?? '');

    return {
      source,
      title: item.title,
      snippet: body ? `${stats}. ${body}` : stats,
      url,
      relevanceScore: normalizeRedditRank(index, item.ups ?? 0, item.num_comments ?? 0),
    };
  }

  private toHackerNewsFinding(
    item: HackerNewsHit,
    index: number,
  ): Finding | null {
    const title = item.title ?? item.story_title;
    if (!title || !item.objectID) {
      return null;
    }

    const url = normalizeExternalUrl(item.url ?? item.story_url)
      ?? `https://news.ycombinator.com/item?id=${item.objectID}`;
    const source = this.createSource(
      url,
      `[Hacker News] ${title}`,
      item.created_at ?? new Date().toISOString(),
    );
    const stats = `Hacker News • ${item.points ?? 0} points`;
    const body = cleanSnippet(
      item.story_text
        ?? item.comment_text
        ?? item._highlightResult?.title?.value
        ?? title,
    );

    return {
      source,
      title,
      snippet: body ? `${stats}. ${body}` : stats,
      url,
      relevanceScore: normalizeHackerNewsRank(index, item.points ?? 0),
    };
  }

  private createSource(url: string, title: string, retrievedAt: string): Source {
    return {
      url,
      title,
      type: this.sourceType,
      retrievedAt,
    };
  }

  private normalizeFindingKey(url: string): string {
    try {
      const normalized = new URL(url);
      normalized.hash = '';
      if (normalized.pathname.endsWith('/')) {
        normalized.pathname = normalized.pathname.slice(0, -1);
      }
      return normalized.toString();
    } catch {
      return url.trim();
    }
  }
}

interface RedditSearchResponse {
  data?: {
    children?: Array<{
      data?: RedditPost;
    }>;
  };
}

interface RedditPost {
  title?: string;
  selftext?: string;
  permalink?: string;
  url?: string;
  subreddit?: string;
  ups?: number;
  num_comments?: number;
  created_utc?: number;
}

interface HackerNewsSearchResponse {
  hits?: HackerNewsHit[];
}

interface HackerNewsHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  story_text?: string;
  comment_text?: string;
  created_at?: string;
  points?: number;
  _highlightResult?: {
    title?: {
      value?: string;
    };
  };
}

function normalizeRedditRank(
  index: number,
  upvotes: number,
  comments: number,
): number {
  const rankScore = Math.max(0.25, 0.78 - index * 0.08);
  const engagementBoost = Math.min(upvotes / 5000 + comments / 2500, 0.22);
  return Math.round(Math.min(rankScore + engagementBoost, 1) * 100) / 100;
}

function normalizeHackerNewsRank(index: number, points: number): number {
  const rankScore = Math.max(0.25, 0.76 - index * 0.08);
  const pointsBoost = Math.min(points / 800, 0.22);
  return Math.round(Math.min(rankScore + pointsBoost, 1) * 100) / 100;
}

function cleanSnippet(snippet: string): string {
  return decodeHtml(snippet)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeExternalUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}
