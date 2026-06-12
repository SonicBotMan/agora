import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomCrawler } from './custom';
import { TwitterCrawler } from './twitter';
import { WeiboCrawler } from './weibo';

describe('CustomCrawler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('parses RSS feeds into topic items', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <rss>
        <channel>
          <item>
            <title>Open Source AI Release</title>
            <description>Fresh tooling for local model workflows.</description>
            <link>https://example.com/rss/open-source-ai</link>
            <pubDate>2026-06-07T08:00:00.000Z</pubDate>
            <category>AI</category>
          </item>
        </channel>
      </rss>
    `)));

    const crawler = new CustomCrawler();
    const result = await crawler.fetch({
      url: 'https://example.com/feed.xml',
      type: 'rss',
      source: 'custom-rss',
      category: 'ai',
      tags: ['watchlist'],
    });

    expect(result.error).toBeUndefined();
    expect(result.source).toBe('custom-rss');
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0]).toMatchObject({
      source: 'custom-rss',
      category: 'ai',
      title: 'Open Source AI Release',
      url: 'https://example.com/rss/open-source-ai',
    });
    expect(result.topics[0].tags).toEqual(
      expect.arrayContaining(['custom-rss', 'watchlist', 'ai']),
    );
  });

  it('parses JSON API payloads with field mapping and nested item paths', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: {
        posts: [
          {
            headline: 'Inference Cluster Upgrade',
            blurb: 'Operators are consolidating serving and observability.',
            href: '/posts/inference-upgrade',
            published_at: '2026-06-07T10:00:00.000Z',
            popularity: 87,
            labels: ['infra', 'llm'],
          },
        ],
      },
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    })));

    const crawler = new CustomCrawler();
    const result = await crawler.fetch({
      url: 'https://example.com/api/posts',
      type: 'json-api',
      source: 'custom-json',
      category: 'tech',
      itemPath: 'data.posts',
      titleField: 'headline',
      summaryField: 'blurb',
      linkField: 'href',
      dateField: 'published_at',
      scoreField: 'popularity',
      tagsField: 'labels',
      baseUrl: 'https://example.com',
    });

    expect(result.error).toBeUndefined();
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0]).toMatchObject({
      source: 'custom-json',
      title: 'Inference Cluster Upgrade',
      url: 'https://example.com/posts/inference-upgrade',
      score: 87,
      category: 'tech',
    });
    expect(result.topics[0].tags).toEqual(
      expect.arrayContaining(['custom-json', 'infra', 'llm']),
    );
  });

  it('parses HTML pages with selectors and attributes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <html>
        <body>
          <article class="story">
            <a class="story-link" href="/stories/browser-runtime" title="Browser Runtime Refresh">Browser Runtime Refresh</a>
            <p class="story-summary">Debugging and preview flows are converging into one runtime.</p>
            <span class="story-score">91 points</span>
            <time class="story-date">2026-06-07T12:30:00.000Z</time>
            <span class="story-tags">frontend, runtime</span>
          </article>
        </body>
      </html>
    `)));

    const crawler = new CustomCrawler();
    const result = await crawler.fetch({
      url: 'https://example.com/stories',
      type: 'html',
      source: 'custom-html',
      category: 'tech',
      itemSelector: 'article.story',
      titleSelector: 'a.story-link',
      titleAttribute: 'title',
      linkSelector: 'a.story-link',
      summarySelector: '.story-summary',
      scoreSelector: '.story-score',
      dateSelector: '.story-date',
      tagsSelector: '.story-tags',
      baseUrl: 'https://example.com',
    });

    expect(result.error).toBeUndefined();
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0]).toMatchObject({
      source: 'custom-html',
      title: 'Browser Runtime Refresh',
      url: 'https://example.com/stories/browser-runtime',
      score: 91,
    });
    expect(result.topics[0].tags).toEqual(
      expect.arrayContaining(['custom-html', 'frontend', 'runtime']),
    );
  });

  it('returns a configuration error when HTML selectors are incomplete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><body></body></html>')));

    const crawler = new CustomCrawler();
    const result = await crawler.fetch({
      url: 'https://example.com/stories',
      type: 'html',
    });

    expect(result.topics).toEqual([]);
    expect(result.error).toBe('HTML custom crawler requires itemSelector');
  });
});

describe('social crawler wrappers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a clean config error for twitter when no source config is provided', async () => {
    const crawler = new TwitterCrawler();
    const result = await crawler.fetch();

    expect(result).toMatchObject({
      source: 'twitter',
      topics: [],
      error: 'Twitter crawler requires a custom config with url and type',
    });
  });

  it('delegates weibo fetching through the custom crawler with source tagging', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [
        {
          title: 'Weibo Hot Search Topic',
          summary: 'A major discussion is accelerating on Weibo.',
          url: 'https://weibo.example.com/topic',
          score: 76,
          tags: ['hot-search'],
        },
      ],
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    })));

    const crawler = new WeiboCrawler();
    const result = await crawler.fetch({
      url: 'https://weibo.example.com/api/hot',
      type: 'json-api',
      category: 'social',
    });

    expect(result.error).toBeUndefined();
    expect(result.source).toBe('weibo');
    expect(result.topics[0].tags).toEqual(
      expect.arrayContaining(['weibo', 'hot-search']),
    );
  });
});
