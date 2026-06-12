import { describe, expect, it, vi } from 'vitest';

import { ConversationIngestor } from './ConversationIngestor';
import { EmbeddingEngine, LocalHashingProvider } from './EmbeddingEngine';
import { KnowledgeStore } from './KnowledgeStore';
import type { ConversationMessage, Entity } from './types';

function createMessages(count: number): ConversationMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content:
      index === 0
        ? 'Alice Johnson uses TypeScript with Agora Studio for frontend planning.'
        : `Message ${index + 1} about TypeScript delivery and Agora workflows.`,
    timestamp: `2026-06-07T00:00:${String(index).padStart(2, '0')}.000Z`,
  }));
}

function createEntity(name: string, target = 'TypeScript'): Entity {
  return {
    name,
    type: 'person',
    relations: [{ target, type: 'uses' }],
  };
}

describe('ConversationIngestor', () => {
  it('embeds and persists conversation documents into the knowledge store', async () => {
    const store = new KnowledgeStore();
    const ingestor = new ConversationIngestor({
      knowledgeStore: store,
      embeddingEngine: new EmbeddingEngine({
        provider: new LocalHashingProvider({ dimensions: 64 }),
      }),
      maxMessagesPerDoc: 2,
    });

    const summary = await ingestor.ingest('session-123', createMessages(3));
    const documents = await store.list();

    expect(summary).toMatchObject({
      total: 2,
      succeeded: 2,
      failed: 0,
    });
    expect(summary.results).toHaveLength(2);
    expect(documents).toHaveLength(2);
    expect(documents.every((document) => document.sourceId === 'session-123')).toBe(true);
    expect(documents.every((document) => document.metadata.embedding?.length === 64)).toBe(true);
    expect(documents[0]?.metadata.tags).toContain('conversation');
    expect(documents[0]?.metadata.tags).toContain('session-123');
  });

  it('deduplicates extracted entities and reports progress events for each group', async () => {
    const store = new KnowledgeStore();
    const extractor = {
      extract: vi.fn().mockResolvedValue([
        createEntity('Alice Johnson'),
        createEntity('Alice Johnson'),
      ]),
    };
    const ingestor = new ConversationIngestor({
      knowledgeStore: store,
      entityExtractor: extractor as never,
      embeddingEngine: new EmbeddingEngine({
        provider: new LocalHashingProvider({ dimensions: 32 }),
      }),
      maxMessagesPerDoc: 1,
    });
    const progressEvents: Array<Record<string, unknown>> = [];

    ingestor.on('ingest:progress', (event) => {
      progressEvents.push(event as Record<string, unknown>);
    });

    const summary = await ingestor.ingest('session-entities', createMessages(2));
    const stored = await store.list();

    expect(summary.succeeded).toBe(2);
    expect(progressEvents).toHaveLength(2);
    expect(
      stored.every((document) => document.metadata.entities.length === 1),
    ).toBe(true);
    expect(stored[0]?.metadata.entities[0]).toMatchObject({
      name: 'Alice Johnson',
      relations: [{ target: 'TypeScript', type: 'uses' }],
    });
  });

  it('still succeeds without a knowledge store and reports that persistence is disabled', async () => {
    const ingestor = new ConversationIngestor({
      embeddingEngine: new EmbeddingEngine({
        provider: new LocalHashingProvider({ dimensions: 16 }),
      }),
      maxMessagesPerDoc: 4,
    });

    const summary = await ingestor.ingest('session-memory-only', createMessages(2));

    expect(ingestor.hasKnowledgeStore()).toBe(false);
    expect(summary).toMatchObject({
      total: 1,
      succeeded: 1,
      failed: 0,
    });
    expect(summary.results[0]?.documentId).toContain('conversation-session-memory-only');
  });

  it('reuses stable document ids for the same session and prunes stale conversation chunks', async () => {
    const store = new KnowledgeStore();
    const ingestor = new ConversationIngestor({
      knowledgeStore: store,
      embeddingEngine: new EmbeddingEngine({
        provider: new LocalHashingProvider({ dimensions: 24 }),
      }),
      maxMessagesPerDoc: 2,
    });

    await ingestor.ingest('session-refresh', createMessages(3));
    let documents = await store.list();

    expect(documents).toHaveLength(2);
    const firstIds = documents.map((document) => document.id).sort();

    await ingestor.ingest('session-refresh', createMessages(2));
    documents = await store.list();

    expect(documents).toHaveLength(1);
    expect(documents[0]?.id).toBe(firstIds[0]);
    expect(documents[0]?.sourceId).toBe('session-refresh');
  });
});
