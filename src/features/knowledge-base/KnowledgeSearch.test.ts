import { beforeEach, describe, expect, it } from 'vitest';

import { EmbeddingEngine, LocalHashingProvider } from './EmbeddingEngine';
import { HybridSearchEngine } from './KnowledgeSearch';
import { KnowledgeStore } from './KnowledgeStore';
import type { KnowledgeDocument } from './types';

function createDocument(
  id: string,
  title: string,
  content: string,
  tags: string[],
): KnowledgeDocument {
  return {
    id,
    title,
    source: 'manual',
    content,
    contentType: 'markdown',
    metadata: {
      tags,
      entities: [],
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
    },
  };
}

describe('HybridSearchEngine', () => {
  let store: KnowledgeStore;
  let embedder: EmbeddingEngine;
  let search: HybridSearchEngine;

  beforeEach(() => {
    store = new KnowledgeStore();
    embedder = new EmbeddingEngine({
      provider: new LocalHashingProvider({ dimensions: 128 }),
    });
    search = new HybridSearchEngine(store, embedder, {
      minScore: 0.05,
    });
  });

  it('lazily embeds stored documents for embedding search and persists the vectors', async () => {
    const matching = createDocument(
      'doc-1',
      'Frontend Station',
      'Monaco editor and terminal workflow for frontend station development.',
      ['frontend', 'agora'],
    );
    const unrelated = createDocument(
      'doc-2',
      'Finance Memo',
      'Quarterly revenue forecast and margin planning notes.',
      ['finance'],
    );

    await store.save(matching);
    await store.save(unrelated);

    const results = await search.searchByEmbedding(
      { keywords: ['frontend', 'terminal', 'monaco'] },
      { limit: 5 },
    );

    expect(results).toHaveLength(2);
    expect(results[0].document.id).toBe('doc-1');
    expect(results[0].score).toBeGreaterThan(results[1].score);

    const persistedMatching = await store.get('doc-1');
    const persistedUnrelated = await store.get('doc-2');
    expect(persistedMatching?.metadata.embedding).toHaveLength(128);
    expect(persistedUnrelated?.metadata.embedding).toHaveLength(128);
  });

  it('combines keyword and embedding signals while honoring source and tag filters', async () => {
    const frontend = await embedder.embedDocument(createDocument(
      'doc-frontend',
      'Agora Frontend Station',
      'Frontend station with preview, monaco editor, terminal session, and file tree.',
      ['agora', 'frontend'],
    ));
    const research = await embedder.embedDocument({
      ...createDocument(
        'doc-research',
        'Architecture Research',
        'Research findings about orchestrator planning and delivery workflows.',
        ['agora', 'research'],
      ),
      source: 'research',
    });
    const other = await embedder.embedDocument(createDocument(
      'doc-other',
      'Marketing Campaign',
      'Campaign planning, channels, and launch assets.',
      ['marketing'],
    ));

    await store.save(frontend);
    await store.save(research);
    await store.save(other);

    const results = await search.searchHybrid(
      {
        keywords: ['agora', 'frontend', 'terminal'],
        hybridWeight: 0.65,
      },
      {
        limit: 5,
        source: 'manual',
        tags: ['agora'],
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      matchType: 'hybrid',
      document: expect.objectContaining({
        id: 'doc-frontend',
      }),
    });
    expect(results[0].score).toBeGreaterThan(0.1);
  });

  it('expands entity matches through linked relations', async () => {
    await store.save({
      ...createDocument(
        'doc-direct',
        'OpenCode Overview',
        'OpenCode connects local agent tasks to a TypeScript workspace.',
        ['agora', 'tooling'],
      ),
      metadata: {
        ...createDocument(
          'doc-direct',
          'OpenCode Overview',
          'OpenCode connects local agent tasks to a TypeScript workspace.',
          ['agora', 'tooling'],
        ).metadata,
        entities: [
          {
            name: 'OpenCode',
            type: 'tool',
            relations: [{ target: 'TypeScript', type: 'built_with' }],
          },
        ],
      },
    });
    await store.save({
      ...createDocument(
        'doc-related',
        'TypeScript Runtime Notes',
        'TypeScript powers the renderer and main-process integrations.',
        ['agora', 'runtime'],
      ),
      metadata: {
        ...createDocument(
          'doc-related',
          'TypeScript Runtime Notes',
          'TypeScript powers the renderer and main-process integrations.',
          ['agora', 'runtime'],
        ).metadata,
        entities: [
          {
            name: 'TypeScript',
            type: 'tech',
            relations: [],
          },
        ],
      },
    });
    await store.save(createDocument(
      'doc-unrelated',
      'Marketing Notes',
      'Launch campaign planning and social assets.',
      ['marketing'],
    ));

    const results = await search.searchByEntity(
      { entities: ['OpenCode'] },
      { limit: 5 },
    );

    expect(results.map(result => result.document.id)).toEqual(['doc-direct', 'doc-related']);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    expect(results.every(result => result.matchType === 'entity')).toBe(true);
  });
});
