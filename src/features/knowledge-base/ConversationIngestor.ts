/**
 * ConversationIngestor — ingests conversation history into the knowledge base.
 *
 * Transforms a session's message log into structured KnowledgeDocument entries,
 * extracting key information and insights for long-term storage.
 */

import { EventEmitter } from 'events';

import type {
  KnowledgeDocument,
  KnowledgeSource,
  ConversationMessage,
  IngestionResult,
  IngestionSummary,
} from './types';
import { DocumentProcessor } from './DocumentProcessor';
import { EntityExtractor } from './EntityExtractor';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ConversationIngestorOptions {
  documentProcessor?: DocumentProcessor;
  entityExtractor?: EntityExtractor;
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
  private maxMessagesPerDoc: number;

  constructor(options: ConversationIngestorOptions = {}) {
    super();
    this.processor = options.documentProcessor ?? new DocumentProcessor();
    this.extractor = options.entityExtractor ?? new EntityExtractor();
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

        // Attach entities to each document
        const enriched = documents.map((doc) => ({
          ...doc,
          metadata: {
            ...doc.metadata,
            entities: [...doc.metadata.entities, ...entities],
          },
          sourceId: sessionId,
        }));

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

    this.emitEvent('ingest:complete', sessionId, {
      total: results.length,
      succeeded,
      failed,
    });

    return { total: results.length, succeeded, failed, results };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private groupMessages(messages: ConversationMessage[]): ConversationMessage[][] {
    const groups: ConversationMessage[][] = [];
    for (let i = 0; i < messages.length; i += this.maxMessagesPerDoc) {
      groups.push(messages.slice(i, i + this.maxMessagesPerDoc));
    }
    return groups;
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
