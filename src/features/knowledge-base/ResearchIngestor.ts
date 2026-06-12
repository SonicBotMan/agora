/**
 * ResearchIngestor — ingests research results into the knowledge base.
 *
 * Transforms deep research findings and reports into structured
 * KnowledgeDocument entries for long-term retention.
 */

import { EventEmitter } from 'events';

import { DocumentProcessor } from './DocumentProcessor';
import { EmbeddingEngine } from './EmbeddingEngine';
import { EntityExtractor } from './EntityExtractor';
import { KnowledgeStore } from './KnowledgeStore';
import type {
  Entity,
  IngestionResult,
  IngestionSummary,
  KnowledgeDocument,
  KnowledgeSource,
  ResearchResult,
} from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ResearchIngestorOptions {
  documentProcessor?: DocumentProcessor;
  entityExtractor?: EntityExtractor;
  embeddingEngine?: EmbeddingEngine;
  knowledgeStore?: KnowledgeStore;
}

export type ResearchIngestorEventType =
  | 'ingest:start'
  | 'ingest:complete'
  | 'error';

export interface ResearchIngestorEvent {
  type: ResearchIngestorEventType;
  query: string;
  timestamp: string;
  payload?: unknown;
}

// ── Implementation ──────────────────────────────────────────────────────────

export class ResearchIngestor extends EventEmitter {
  private processor: DocumentProcessor;
  private extractor: EntityExtractor;
  private embedder: EmbeddingEngine;
  private store?: KnowledgeStore;

  constructor(options: ResearchIngestorOptions = {}) {
    super();
    this.processor = options.documentProcessor ?? new DocumentProcessor();
    this.extractor = options.entityExtractor ?? new EntityExtractor();
    this.embedder = options.embeddingEngine ?? new EmbeddingEngine();
    this.store = options.knowledgeStore;
  }

  /**
   * Ingest a research result into KnowledgeDocument entries.
   *
   * Creates two document types:
   *   1. A synthesis document with the full research report.
   *   2. Individual finding documents for each discovered item.
   *
   * @param researchResult - The research result to ingest.
   * @returns Summary of the ingestion operation.
   */
  async ingest(researchResult: ResearchResult): Promise<IngestionSummary> {
    const { query, synthesis, sources, findings } = researchResult;
    const batchId = this.createBatchId(query);

    this.emitEvent('ingest:start', query, {
      sourceCount: sources.length,
      findingCount: findings.length,
    });

    const results: IngestionResult[] = [];

    // 1. Ingest the synthesis / report body
    try {
      const synthesisDocs = await this.ingestSynthesis(
        query,
        synthesis,
        sources,
        `${batchId}-report`,
      );
      results.push(...synthesisDocs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        success: false,
        documentId: '',
        title: `Research: ${query}`,
        chunks: 0,
        entities: [],
        error: message,
      });
      this.emitEvent('error', query, { phase: 'synthesis', error: message });
    }

    // 2. Ingest individual findings
    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i];

      try {
        const title = `Finding: ${finding.title || `#${i + 1}`}`;
        const text = `${finding.title}\n\n${finding.snippet}\n\nSource: ${finding.url}`;

        const documents = this.processor.processText(text, {
          title,
          source: 'research' as KnowledgeSource,
          tags: ['research', query, ...this.extractTags(finding.snippet)],
        });

        const entities = await this.extractor.extract(finding.snippet);
        const enriched = await this.prepareDocuments(
          documents,
          `${batchId}-finding-${i + 1}`,
          finding.url,
          entities,
        );
        await this.persistDocuments(enriched);

        results.push({
          success: true,
          documentId: enriched[0]?.id ?? '',
          title,
          chunks: enriched.length,
          entities,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          success: false,
          documentId: '',
          title: `Finding: ${findings[i].title || `#${i + 1}`}`,
          chunks: 0,
          entities: [],
          error: message,
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    this.emitEvent('ingest:complete', query, {
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

  private async ingestSynthesis(
    query: string,
    synthesis: string,
    sources: Array<{ url: string; title: string }>,
    batchId: string,
  ): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    // Build a combined report with source citations
    const sourceList = sources
      .map((s) => `- [${s.title}](${s.url})`)
      .join('\n');

    const reportText = `# Research: ${query}\n\n## Synthesis\n\n${synthesis}\n\n## Sources\n\n${sourceList}`;

    const documents = this.processor.processMarkdown(reportText, {
      title: `Research: ${query}`,
      source: 'research',
      tags: ['research', 'report', query],
    });

    const entities = await this.extractor.extract(synthesis);
    const enriched = await this.prepareDocuments(
      documents,
      batchId,
      sources[0]?.url,
      entities,
    );
    await this.persistDocuments(enriched);

    results.push({
      success: true,
      documentId: enriched[0]?.id ?? '',
      title: `Research: ${query}`,
      chunks: enriched.length,
      entities,
    });

    return results;
  }

  private async prepareDocuments(
    documents: KnowledgeDocument[],
    batchId: string,
    sourceId: string | undefined,
    entities: Entity[],
  ): Promise<KnowledgeDocument[]> {
    const uniqueEntities = this.mergeEntities(
      documents[0]?.metadata.entities ?? [],
      entities,
    );
    const normalized = documents.map((doc, index) => ({
      ...doc,
      id: `${batchId}-${index + 1}-${doc.id}`,
      sourceId,
      metadata: {
        ...doc.metadata,
        tags: [...new Set(doc.metadata.tags)],
        entities: uniqueEntities,
      },
    }));

    return this.embedder.embedDocuments(normalized);
  }

  private async persistDocuments(
    documents: KnowledgeDocument[],
  ): Promise<void> {
    if (!this.store) {
      return;
    }

    await Promise.all(documents.map(async (document) => {
      await this.store?.save(document);
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

  private createBatchId(query: string): string {
    const slug = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return `research-${slug || 'result'}-${Date.now()}`;
  }

  private extractTags(text: string): string[] {
    // Simple tag extraction: pull out capitalized multi-word phrases
    const tagRegex = /[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}/g;
    const matches = text.match(tagRegex);
    return matches
      ? [...new Set(matches.map((m) => m.toLowerCase().replace(/\s+/g, '-')))]
      : [];
  }

  private emitEvent(type: ResearchIngestorEventType, query: string, payload?: unknown): void {
    (this.emit as (event: string, data: ResearchIngestorEvent) => void)(type, {
      type,
      query,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
