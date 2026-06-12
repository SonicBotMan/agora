import { describe, expect, test, vi } from 'vitest';

import { SkillMarketplace } from './SkillMarketplace';
import type { SkillManifest } from './types';

const createJsonResponse = (payload: unknown, status = 200): Response => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

describe('SkillMarketplace', () => {
  test('search maps SkillHub search results into marketplace manifests', async () => {
    const fetchMock = vi.fn(async () => createJsonResponse({
      skills: [
        {
          name: 'Docs Writer',
          slug: 'docs-writer',
          author: 'SkillHub',
          description: 'Generate docs from codebases.',
          category: 'research',
          tags: ['markdown', 'documentation'],
        },
      ],
      total: 1,
    }));

    const marketplace = new SkillMarketplace({
      fetchImpl: fetchMock as typeof fetch,
      limit: 5,
    });

    const results = await marketplace.search('docs');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://skillhub.club/api/v1/desktop/search');
    expect(results).toMatchObject([
      {
        id: 'docs-writer',
        name: 'Docs Writer',
        description: 'Generate docs from codebases.',
        author: 'SkillHub',
        entryFile: 'skillhub:docs-writer',
        source: 'marketplace',
        enabled: false,
        version: '0.0.0',
      },
    ]);
    expect(results[0]?.tags).toEqual(expect.arrayContaining(['skillhub', 'research', 'markdown']));
  });

  test('getFeatured prefers high-signal skills from the catalog payload', async () => {
    const fetchMock = vi.fn(async () => createJsonResponse({
      skills: [
        {
          name: 'Small Utility',
          slug: 'small-utility',
          github_stars: 10,
          simple_score: 2.3,
        },
        {
          name: 'Popular Utility',
          slug: 'popular-utility',
          github_stars: 5000,
          simple_score: 7.1,
        },
        {
          name: 'Top Rated Utility',
          slug: 'top-rated-utility',
          github_stars: 50,
          simple_score: 9.4,
        },
      ],
    }));

    const marketplace = new SkillMarketplace({
      fetchImpl: fetchMock as typeof fetch,
      limit: 10,
    });

    const results = await marketplace.getFeatured();

    expect(results.map(skill => skill.id)).toEqual(['top-rated-utility', 'popular-utility']);
  });

  test('getDetails resolves skillhub URLs and falls back to skill markdown when description is missing', async () => {
    const fetchMock = vi.fn(async () => createJsonResponse({
      skill: {
        name: 'Docs Writer',
        slug: 'docs-writer',
        author: 'SkillHub',
        description: null,
        description_zh: null,
        repo_url: 'https://github.com/example/docs-writer',
        skill_md_raw: '# Docs Writer\n\nGenerate high-quality docs from a local repo.\n\n## Usage\n\nUse it for release notes.',
      },
    }));

    const marketplace = new SkillMarketplace({
      fetchImpl: fetchMock as typeof fetch,
    });

    const skill = await marketplace.getDetails('https://skillhub.lol/skills/docs-writer');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://skillhub.club/api/v1/desktop/skills/docs-writer');
    expect(skill).toMatchObject({
      id: 'docs-writer',
      name: 'Docs Writer',
      entryFile: 'skillhub:docs-writer',
      source: 'marketplace',
    });
    expect(skill.description).toContain('Generate high quality docs from a local repo');
  });

  test('publish posts to a configured endpoint after validating the manifest', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    const marketplace = new SkillMarketplace({
      fetchImpl: fetchMock as typeof fetch,
      publishEndpoint: 'https://example.com/api/skills',
    });

    const manifest: SkillManifest = {
      id: 'docs-writer',
      name: 'Docs Writer',
      version: '1.0.0',
      description: 'Generate docs.',
      author: 'Agora',
      tags: ['docs'],
      entryFile: '/tmp/skill.ts',
      enabled: true,
      installedAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
      source: 'local',
    };

    await marketplace.publish(manifest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.com/api/skills');
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.body).toBe(JSON.stringify(manifest));
  });

  test('publish fails fast when no publish endpoint is configured', async () => {
    const marketplace = new SkillMarketplace();

    await expect(marketplace.publish({
      id: 'docs-writer',
      name: 'Docs Writer',
      version: '1.0.0',
      description: 'Generate docs.',
      author: 'Agora',
      tags: ['docs'],
      entryFile: '/tmp/skill.ts',
      enabled: true,
      installedAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
      source: 'local',
    })).rejects.toThrow('publish endpoint is not configured');
  });
});
