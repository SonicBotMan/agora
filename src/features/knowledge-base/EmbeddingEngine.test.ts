import { describe, expect, it, vi } from 'vitest';

import { EmbeddingEngine, LocalHashingProvider, NoOpProvider, OllamaProvider } from './EmbeddingEngine';
import type { KnowledgeDocument } from './types';

function createDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    id: 'doc-1',
    title: 'Agora Architecture Rewrite',
    source: 'manual',
    content: 'Agora architecture rewrite for Electron, React, and TypeScript.',
    contentType: 'markdown',
    metadata: {
      tags: ['agora', 'architecture'],
      entities: [],
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('EmbeddingEngine', () => {
  it('uses the local hashing provider by default and embeds documents offline', async () => {
    const engine = new EmbeddingEngine();
    const embedded = await engine.embedDocument(createDocument());

    expect(engine.provider.name).toBe('local-hash');
    expect(embedded.metadata.embedding).toHaveLength(256);
    expect(
      embedded.metadata.embedding?.some((value) => Math.abs(value) > 0),
    ).toBe(true);
  });

  it('produces stable vectors with strong self-similarity and weaker unrelated similarity', async () => {
    const provider = new LocalHashingProvider({ dimensions: 128 });
    const engine = new EmbeddingEngine({ provider });
    const a = await provider.embed('frontend station monaco editor terminal preview');
    const b = await provider.embed('frontend station monaco editor terminal preview');
    const c = await provider.embed('financial report forecasting and revenue planning');

    expect(a).toHaveLength(128);
    expect(b).toEqual(a);
    expect(engine.cosineSimilarity(a, b)).toBeGreaterThan(0.99);
    expect(engine.cosineSimilarity(a, c)).toBeLessThan(0.6);
  });

  it('preserves explicit noop mode for keyword-only search setups', async () => {
    const engine = new EmbeddingEngine({
      provider: new NoOpProvider(),
    });
    const embedded = await engine.embedDocument(createDocument());

    expect(engine.provider.name).toBe('noop');
    expect(embedded.metadata.embedding).toEqual([]);
  });

  it('ollama provider normalizes single embeddings from the legacy endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      embedding: [3, 4],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const provider = new OllamaProvider({
      fetchImpl: fetchMock as typeof fetch,
      timeout: 1000,
    });

    const embedding = await provider.embed('hello world');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:11434/api/embeddings');
    expect(embedding[0]).toBeCloseTo(0.6, 5);
    expect(embedding[1]).toBeCloseTo(0.8, 5);
  });

  it('ollama provider uses the batch endpoint when it is available', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/embed')) {
        return new Response(JSON.stringify({
          embeddings: [
            [1, 0],
            [0, 2],
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected url ${url}`);
    });
    const provider = new OllamaProvider({
      fetchImpl: fetchMock as typeof fetch,
      timeout: 1000,
    });

    const embeddings = await provider.embedBatch(['alpha', 'beta']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:11434/api/embed');
    expect(embeddings).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it('ollama provider falls back to single embeds when batch embed is unavailable', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/embed')) {
        throw new Error('batch unsupported');
      }

      return new Response(JSON.stringify({
        embedding: url.endsWith('/api/embeddings') ? [0, 5] : [],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const provider = new OllamaProvider({
      fetchImpl: fetchMock as typeof fetch,
      timeout: 1000,
    });

    const embeddings = await provider.embedBatch(['alpha', 'beta']);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:11434/api/embed',
      'http://localhost:11434/api/embeddings',
      'http://localhost:11434/api/embeddings',
    ]);
    expect(embeddings).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });
});
