/**
 * ConversationIngestor — ingests conversation history into the knowledge base.
 *
 * Transforms a session's message log into structured KnowledgeDocument entries,
 * extracting key information and insights for long-term storage.
 */

import { EventEmitter } from 'events';

import { DocumentProcessor } from './DocumentProcessor';
import { EmbeddingEngine } from './EmbeddingEngine';
import { EntityExtractor } from './EntityExtractor';
import { KnowledgeStore } from './KnowledgeStore';
import type {
  ConversationMessage,
  Entity,
  IngestionResult,
  IngestionSummary,
  KnowledgeDocument,
  KnowledgeSource,
} from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ConversationIngestorOptions {
  documentProcessor?: DocumentProcessor;
  entityExtractor?: EntityExtractor;
  embeddingEngine?: EmbeddingEngine;
  knowledgeStore?: KnowledgeStore;
  maxMessagesPerDoc?: number;
}

export type ConversationIngestorEventType =
  | 'ingest:start'
  | 'ingest:progress'
  | 'ingest:complete'
  | 'error';

export interface ConversationIngestorEvent {
  type: ConversationIngestorEventType;
  sessionId: string;
  timestamp: string;
  payload?: unknown;
}

// ── Implementation ──────────────────────────────────────────────────────────

export class ConversationIngestor extends EventEmitter {
  private processor: DocumentProcessor;
  private extractor: EntityExtractor;
  private embedder: EmbeddingEngine;
  private store?: KnowledgeStore;
  private maxMessagesPerDoc: number;

  constructor(options: ConversationIngestorOptions = {}) {
    super();
    this.processor = options.documentProcessor ?? new DocumentProcessor();
    this.extractor = options.entityExtractor ?? new EntityExtractor();
    this.embedder = options.embeddingEngine ?? new EmbeddingEngine();
    this.store = options.knowledgeStore;
    this.maxMessagesPerDoc = options.maxMessagesPerDoc ?? 50;
  }

  /**
   * Ingest a conversation session into KnowledgeDocument entries.
   *
   * @param sessionId - Unique identifier for the conversation session.
   * @param messages  - Ordered array of conversation messages.
   * @returns Summary of the ingestion operation.
   */
  async ingest(
    sessionId: string,
    messages: ConversationMessage[]
  ): Promise<IngestionSummary> {
    this.emitEvent('ingest:start', sessionId, { messageCount: messages.length });

    const results: IngestionResult[] = [];
    const batchId = this.createBatchId(sessionId);
    const persistedDocumentIds = new Set<string>();

    // Group messages into digestible chunks
    const groups = this.groupMessages(messages);

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const title = `Conversation: ${sessionId} (part ${i + 1})`;

      try {
        const text = group
          .map((m) => `[${m.role}] ${m.content}`)
          .join('\n\n');

        const documents = this.processor.processText(text, {
          title,
          source: 'conversation' as KnowledgeSource,
          tags: ['conversation', sessionId],
        });

        // Extract entities from the conversation text
        const entities = await this.extractor.extract(text);
        const enriched = await this.prepareDocuments(
          documents,
          `${batchId}-part-${i + 1}`,
          sessionId,
          entities,
        );
        await this.persistDocuments(enriched);
        enriched.forEach((document) => persistedDocumentIds.add(document.id));

        results.push({
          success: true,
          documentId: enriched[0]?.id ?? '',
          title,
          chunks: enriched.length,
          entities,
        });

        this.emitEvent('ingest:progress', sessionId, {
          part: i + 1,
          total: groups.length,
          documentId: enriched[0]?.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          success: false,
          documentId: '',
          title,
          chunks: 0,
          entities: [],
          error: message,
        });
        this.emitEvent('error', sessionId, { error: message });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (failed === 0) {
      await this.prunePersistedDocuments(sessionId, persistedDocumentIds);
    }

    this.emitEvent('ingest:complete', sessionId, {
      total: results.length,
      succeeded,
      failed,
    });

    return { total: results.length, succeeded, failed, results };
  }

  hasKnowledgeStore(): boolean {
    return Boolean(this.store);
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private groupMessages(messages: ConversationMessage[]): ConversationMessage[][] {
    const groups: ConversationMessage[][] = [];
    for (let i = 0; i < messages.length; i += this.maxMessagesPerDoc) {
      groups.push(messages.slice(i, i + this.maxMessagesPerDoc));
    }
    return groups;
  }

  private async prepareDocuments(
    documents: KnowledgeDocument[],
    batchId: string,
    sessionId: string,
    entities: Entity[],
  ): Promise<KnowledgeDocument[]> {
    const uniqueEntities = this.mergeEntities(
      documents[0]?.metadata.entities ?? [],
      entities,
    );
    const normalized = documents.map((doc, index) => ({
      ...doc,
      id: `${batchId}-${index + 1}-${doc.id}`,
      sourceId: sessionId,
      metadata: {
        ...doc.metadata,
        tags: [...new Set(doc.metadata.tags)],
        entities: uniqueEntities,
      },
    }));

    return this.embedder.embedDocuments(normalized);
  }

  private async persistDocuments(documents: KnowledgeDocument[]): Promise<void> {
    if (!this.store) {
      return;
    }

    await Promise.all(documents.map(async (document) => {
      await this.store?.save(document);
    }));
  }

  private async prunePersistedDocuments(
    sessionId: string,
    persistedDocumentIds: Set<string>,
  ): Promise<void> {
    if (!this.store) {
      return;
    }

    const total = await this.store.count();
    if (total === 0) {
      return;
    }

    const existingDocuments = await this.store.list(0, total);
    const staleDocuments = existingDocuments.filter((document) => (
      document.source === 'conversation'
      && document.sourceId === sessionId
      && !persistedDocumentIds.has(document.id)
    ));

    await Promise.all(staleDocuments.map(async (document) => {
      await this.store?.delete(document.id);
    }));
  }

  private mergeEntities(
    left: Entity[],
    right: Entity[],
  ): Entity[] {
    const entities = new Map<string, typeof left[number]>();

    for (const entity of [...left, ...right]) {
      const existing = entities.get(entity.name);
      if (!existing) {
        entities.set(entity.name, {
          ...entity,
          relations: [...entity.relations],
        });
        continue;
      }

      const relations = new Map(
        existing.relations.map((relation) => [
          `${relation.target}:${relation.type}`,
          relation,
        ]),
      );

      for (const relation of entity.relations) {
        relations.set(`${relation.target}:${relation.type}`, relation);
      }

      entities.set(entity.name, {
        ...existing,
        relations: Array.from(relations.values()),
      });
    }

    return Array.from(entities.values());
  }

  private createBatchId(sessionId: string): string {
    const slug = sessionId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return `conversation-${slug || 'session'}`;
  }

  private emitEvent(type: ConversationIngestorEventType, sessionId: string, payload?: unknown): void {
    (this.emit as (event: string, data: ConversationIngestorEvent) => void)(type, {
      type,
      sessionId,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
