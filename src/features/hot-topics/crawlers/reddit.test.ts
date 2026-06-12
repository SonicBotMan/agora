import { afterEach, describe, expect, it, vi } from 'vitest';

import { RedditCrawler } from './reddit';

function createRedditResponse(posts: Array<Record<string, unknown>>, status = 200): Response {
  return new Response(JSON.stringify({
    data: {
      children: posts.map((post) => ({ data: post })),
    },
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('RedditCrawler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches configured subreddits, filters low-quality posts, and normalizes topic fields', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/r/technology/top.json')) {
        expect(url).toContain('limit=5');
        expect(url).toContain('raw_json=1');
        expect(url).toContain('t=week');

        return createRedditResponse([
          {
            id: 'tech-1',
            title: 'Open Source AI tooling on the rise',
            selftext: '  Teams are standardizing on reusable model tooling across repos.  ',
            permalink: '/r/technology/comments/tech-1/open_source_ai_tooling/',
            score: 420,
            created_utc: 1_717_800_000,
            subreddit: 'technology',
            link_flair_text: 'Analysis',
          },
          {
            id: 'tech-stickied',
            title: 'Pinned moderator thread',
            selftext: 'ignore me',
            permalink: '/r/technology/comments/stickied/pinned/',
            score: 999,
            created_utc: 1_717_800_001,
            subreddit: 'technology',
            stickied: true,
          },
          {
            id: 'tech-nsfw',
            title: 'Should be filtered',
            permalink: '/r/technology/comments/nsfw/filtered/',
            score: 999,
            created_utc: 1_717_800_002,
            subreddit: 'technology',
            over_18: true,
          },
        ]);
      }

      if (url.includes('/r/MachineLearning/top.json')) {
        return createRedditResponse([
          {
            id: 'ml-1',
            title: 'Benchmark results for GPT agents',
            permalink: '/r/MachineLearning/comments/ml-1/benchmark_results/',
            score: 350,
            created_utc: 1_717_800_100,
            subreddit: 'MachineLearning',
            url: 'https://example.com/agents-benchmark',
            url_overridden_by_dest: 'https://example.com/agents-benchmark',
            link_flair_text: 'Research',
          },
          {
            id: 'tech-1',
            title: 'Duplicate id across feeds should be deduped',
            permalink: '/r/MachineLearning/comments/tech-1/duplicate/',
            score: 100,
            created_utc: 1_717_800_101,
            subreddit: 'MachineLearning',
          },
          {
            id: 'ml-low',
            title: 'Below threshold',
            permalink: '/r/MachineLearning/comments/ml-low/below_threshold/',
            score: 5,
            created_utc: 1_717_800_102,
            subreddit: 'MachineLearning',
          },
        ]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const crawler = new RedditCrawler();
    const result = await crawler.fetch({
      subreddits: ['technology', 'MachineLearning'],
      sort: 'top',
      timeRange: 'week',
      limitPerSubreddit: 5,
      minScore: 10,
      maxItems: 10,
    });

    expect(result.error).toBeUndefined();
    expect(result.topics).toHaveLength(2);
    expect(result.topics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'reddit-tech-1',
        title: 'Open Source AI tooling on the rise',
        summary: 'Teams are standardizing on reusable model tooling across repos.',
        category: 'ai',
        url: 'https://reddit.com/r/technology/comments/tech-1/open_source_ai_tooling/',
        tags: expect.arrayContaining(['reddit', 'technology', 'analysis', 'ai', 'open-source']),
      }),
      expect.objectContaining({
        id: 'reddit-ml-1',
        title: 'Benchmark results for GPT agents',
        summary: 'Research: Benchmark results for GPT agents',
        category: 'ai',
        url: 'https://example.com/agents-benchmark',
        tags: expect.arrayContaining(['reddit', 'machinelearning', 'research', 'gpt', 'benchmark']),
      }),
    ]));
  });

  it('retries a failed subreddit request and succeeds on a later attempt', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts += 1;
      if (attempts < 2) {
        return createRedditResponse([], 500);
      }

      return createRedditResponse([
        {
          id: 'retry-1',
          title: 'Recovered after retry',
          permalink: '/r/programming/comments/retry-1/recovered/',
          score: 42,
          created_utc: 1_717_800_200,
          subreddit: 'programming',
        },
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const crawler = new RedditCrawler({ maxRetries: 2 });
    const result = await crawler.fetch({
      subreddits: ['programming'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.error).toBeUndefined();
    expect(result.topics).toEqual([
      expect.objectContaining({
        id: 'reddit-retry-1',
        title: 'Recovered after retry',
      }),
    ]);
  });

  it('returns an error when every subreddit request fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/r/technology/')) {
        throw new Error('network timeout');
      }
      return createRedditResponse([], 503);
    });
    vi.stubGlobal('fetch', fetchMock);

    const crawler = new RedditCrawler({ maxRetries: 2 });
    const result = await crawler.fetch({
      subreddits: ['technology', 'science'],
    });

    expect(result.topics).toEqual([]);
    expect(result.error).toContain('network timeout');
    expect(result.error).toContain('Reddit API returned 503 for r/science');
  });
});
