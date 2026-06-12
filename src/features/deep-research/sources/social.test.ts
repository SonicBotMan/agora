import { afterEach, describe, expect, it, vi } from 'vitest';

import { SocialSearchAdapter } from './social';

function createJsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => payload,
  } as Response;
}

describe('SocialSearchAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aggregates reddit and hacker news findings, deduplicates, and sorts by relevance', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('reddit.com/search.json')) {
        return createJsonResponse({
          data: {
            children: [
              {
                data: {
                  title: 'Agora release discussion',
                  permalink: '/r/typescript/comments/abc123/agora_release_discussion/',
                  url: 'https://example.com/agora-release',
                  subreddit: 'typescript',
                  selftext: 'TypeScript users are discussing the new Agora release.',
                  ups: 3400,
                  num_comments: 220,
                  created_utc: 1717718400,
                },
              },
            ],
          },
        });
      }

      if (url.includes('hn.algolia.com/api/v1/search')) {
        return createJsonResponse({
          hits: [
            {
              objectID: 'abc123',
              title: 'Agora release discussion',
              url: 'https://example.com/agora-release',
              points: 120,
              created_at: '2026-06-07T00:05:00.000Z',
            },
            {
              objectID: 'def456',
              title: 'Agent orchestration lessons',
              url: 'https://example.com/agent-orchestration-lessons',
              points: 90,
              created_at: '2026-06-07T00:04:00.000Z',
            },
          ],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SocialSearchAdapter();
    const result = await adapter.search('agora', 5);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]).toMatchObject({
      title: 'Agora release discussion',
      url: 'https://example.com/agora-release',
    });
    expect(result.findings[0]?.relevanceScore).toBeGreaterThan(
      result.findings[1]?.relevanceScore ?? 0,
    );
    expect(result.sourceMetadata).toHaveLength(2);
    expect(result.findings.every((finding) => finding.source.type === 'social')).toBe(true);
  });

  it('returns surviving source results when one social backend fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('reddit.com/search.json')) {
        throw new Error('reddit unavailable');
      }

      return createJsonResponse({
        hits: [
          {
            objectID: 'xyz789',
            title: 'Frontend station workflow',
            url: 'https://example.com/frontend-station-workflow',
            points: 75,
            created_at: '2026-06-07T00:06:00.000Z',
          },
        ],
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SocialSearchAdapter();
    const result = await adapter.search('frontend station', 5);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      title: 'Frontend station workflow',
      url: 'https://example.com/frontend-station-workflow',
    });
  });

  it('keeps the strongest version when duplicate urls appear across results', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('reddit.com/search.json')) {
        return createJsonResponse({
          data: {
            children: [
              {
                data: {
                  title: 'Shared link',
                  permalink: '/r/agora/comments/shared/shared_link/',
                  url: 'https://example.com/shared-link',
                  subreddit: 'agora',
                  ups: 10,
                  num_comments: 3,
                  created_utc: 1717718400,
                },
              },
            ],
          },
        });
      }

      return createJsonResponse({
        hits: [
          {
            objectID: 'shared',
            title: 'Shared link',
            url: 'https://example.com/shared-link',
            points: 400,
            created_at: '2026-06-07T00:07:00.000Z',
          },
        ],
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SocialSearchAdapter();
    const result = await adapter.search('shared', 5);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      title: 'Shared link',
      url: 'https://example.com/shared-link',
    });
    expect(result.findings[0]?.snippet).toContain('Hacker News');
  });
});
