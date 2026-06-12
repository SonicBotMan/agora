import { beforeEach, describe, expect, it, vi } from 'vitest';

const knowledgeHandlersTestState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const handle = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });

  return {
    handlers,
    handle,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: knowledgeHandlersTestState.handle,
  },
}));

import { registerKnowledgeHandlers } from './knowledgeHandlers';

function createSearchResult(id: string, tags: string[]) {
  return {
    document: {
      id,
      title: id,
      source: 'research' as const,
      content: `${id} content`,
      contentType: 'markdown' as const,
      metadata: {
        tags,
        entities: [],
        createdAt: '2026-06-07T00:00:00.000Z',
        updatedAt: '2026-06-07T00:00:00.000Z',
      },
    },
    score: 0.8,
    matchType: 'hybrid' as const,
  };
}

describe('knowledgeHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeHandlersTestState.handlers.clear();
  });

  it('searches the knowledge base with pagination and tag filtering', async () => {
    const store = {
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      save: vi.fn(),
    };
    const searchEngine = {
      searchByKeywords: vi.fn(),
      searchByEmbedding: vi.fn(),
      searchByEntity: vi.fn(),
      searchHybrid: vi.fn().mockResolvedValue([
        createSearchResult('doc-1', ['agora']),
        createSearchResult('doc-2', ['agora', 'rewrite']),
        createSearchResult('doc-3', ['other']),
      ]),
    };

    registerKnowledgeHandlers({
      getKnowledgeStore: () => store as never,
      getKnowledgeSearchEngine: () => searchEngine as never,
    });

    const search = knowledgeHandlersTestState.handlers.get('knowledge:search');

    await expect(
      search?.({}, 'agora rewrite', {
        tags: ['agora'],
        offset: 1,
        limit: 1,
      }),
    ).resolves.toMatchObject({
      success: true,
      total: 2,
      results: [
        expect.objectContaining({
          document: expect.objectContaining({ id: 'doc-2' }),
        }),
      ],
    });

    expect(searchEngine.searchHybrid).toHaveBeenCalledWith(
      { keywords: ['agora', 'rewrite'] },
      {
        limit: 2,
        source: undefined,
        tags: ['agora'],
      },
    );
  });

  it('normalizes added documents and exposes store CRUD handlers', async () => {
    const savedDocuments: Array<Record<string, unknown>> = [];
    const store = {
      save: vi.fn(async (document) => {
        savedDocuments.push(document as never);
      }),
      get: vi.fn(async () => ({
        id: 'doc-1',
        title: 'Doc 1',
      })),
      list: vi.fn(async () => [{ id: 'doc-1' }]),
      delete: vi.fn(async () => true),
    };
    const searchEngine = {
      searchByKeywords: vi.fn(),
      searchByEmbedding: vi.fn(),
      searchByEntity: vi.fn(),
      searchHybrid: vi.fn(),
    };

    registerKnowledgeHandlers({
      getKnowledgeStore: () => store as never,
      getKnowledgeSearchEngine: () => searchEngine as never,
    });

    const add = knowledgeHandlersTestState.handlers.get('knowledge:add');
    const get = knowledgeHandlersTestState.handlers.get('knowledge:get');
    const list = knowledgeHandlersTestState.handlers.get('knowledge:list');
    const remove = knowledgeHandlersTestState.handlers.get('knowledge:delete');

    const addResult = await add?.({}, {
      title: 'Research memo',
      source: 'manual',
      content: 'Important note',
      contentType: 'text',
      metadata: {
        tags: ['agora', 'agora'],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(addResult).toMatchObject({
      success: true,
      document: expect.objectContaining({
        title: 'Research memo',
        source: 'manual',
      }),
    });
    expect(savedDocuments[0]).toMatchObject({
      title: 'Research memo',
      metadata: expect.objectContaining({
        tags: ['agora'],
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    await expect(get?.({}, 'doc-1')).resolves.toMatchObject({
      success: true,
      document: { id: 'doc-1', title: 'Doc 1' },
    });
    await expect(list?.({}, 5, 10)).resolves.toMatchObject({
      success: true,
      documents: [{ id: 'doc-1' }],
    });
    await expect(remove?.({}, 'doc-1')).resolves.toMatchObject({
      success: true,
      deleted: true,
    });
  });
});
