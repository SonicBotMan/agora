import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { knowledgeService } from './knowledge';

function createKnowledgeApi() {
  return {
    search: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    add: vi.fn(),
  };
}

describe('knowledgeService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('delegates successful calls to the preload API', async () => {
    const knowledge = createKnowledgeApi();
    const document = {
      id: 'knowledge-1',
      title: 'Research Summary',
      source: 'manual',
      content: '# Notes',
      contentType: 'markdown',
      metadata: {
        tags: ['research'],
        entities: [],
        createdAt: '2026-06-07T00:00:00.000Z',
        updatedAt: '2026-06-07T00:00:00.000Z',
      },
    };
    knowledge.search.mockResolvedValue([
      {
        document,
        score: 0.92,
        matchType: 'hybrid',
        snippet: 'Research Summary',
      },
    ]);
    knowledge.add.mockResolvedValue(document);

    vi.stubGlobal('window', {
      electron: {
        knowledge,
      },
    });

    await expect(knowledgeService.search('research')).resolves.toEqual([
      {
        document,
        score: 0.92,
        matchType: 'hybrid',
        snippet: 'Research Summary',
      },
    ]);
    await expect(knowledgeService.add({
      title: 'Research Summary',
      source: 'manual',
      content: '# Notes',
      contentType: 'markdown',
    })).resolves.toEqual(document);

    expect(knowledge.search).toHaveBeenCalledWith('research', undefined);
  });

  test('returns safe fallbacks when the preload API throws', async () => {
    const knowledge = createKnowledgeApi();
    knowledge.list.mockRejectedValue(new Error('boom'));
    knowledge.get.mockRejectedValue(new Error('boom'));
    knowledge.delete.mockRejectedValue(new Error('boom'));

    vi.stubGlobal('window', {
      electron: {
        knowledge,
      },
    });

    await expect(knowledgeService.list()).resolves.toEqual([]);
    await expect(knowledgeService.get('knowledge-1')).resolves.toBeNull();
    await expect(knowledgeService.delete('knowledge-1')).resolves.toBe(false);
  });
});
