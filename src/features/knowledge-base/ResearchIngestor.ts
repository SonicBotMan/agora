/**
 * ResearchIngestor — ingests research results into the knowledge base.
 *
 * Transforms deep research findings and reports into structured
 * KnowledgeDocument entries for long-term retention.
 */

import { EventEmitter } from 'events';

import type {
  KnowledgeDocument,
  KnowledgeSource,
  ResearchResult,
  IngestionResult,
  IngestionSummary,
} from './types';
import { DocumentProcessor } from './DocumentProcessor';
import { EntityExtractor } from './EntityExtractor';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ResearchIngestorOptions {
  documentProcessor?: DocumentProcessor;
  entityExtractor?: EntityExtractor;
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

  constructor(options: ResearchIngestorOptions = {}) {
    super();
    this.processor = options.documentProcessor ?? new DocumentProcessor();
    this.extractor = options.entityExtractor ?? new EntityExtractor();
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

    this.emitEvent('ingest:start', query, {
      sourceCount: sources.length,
      findingCount: findings.length,
    });

    const results: IngestionResult[] = [];

    // 1. Ingest the synthesis / report body
    try {
      const synthesisDocs = await this.ingestSynthesis(query, synthesis, sources);
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

        const enriched = documents.map((doc) => ({
          ...doc,
          metadata: {
            ...doc.metadata,
            entities: [...doc.metadata.entities, ...entities],
          },
          sourceId: finding.url,
        }));

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

  // ── Private ─────────────────────────────────────────────────────────────

  private async ingestSynthesis(
    query: string,
    synthesis: string,
    sources: Array<{ url: string; title: string; snippet: string }>
  ): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    // Build a combined report with source citations
    const sourceList = sources
      .map((s) => `- [${s.title}](${s.url}): ${s.snippet}`)
      .join('\n');

    const reportText = `# Research: ${query}\n\n## Synthesis\n\n${synthesis}\n\n## Sources\n\n${sourceList}`;

    const documents = this.processor.processMarkdown(reportText, {
      title: `Research: ${query}`,
      source: 'research',
      tags: ['research', 'report', query],
    });

    const entities = await this.extractor.extract(synthesis);

    const enriched = documents.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        entities: [...doc.metadata.entities, ...entities],
      },
      sourceId: sources[0]?.url,
    }));

    results.push({
      success: true,
      documentId: enriched[0]?.id ?? '',
      title: `Research: ${query}`,
      chunks: enriched.length,
      entities,
    });

    return results;
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
