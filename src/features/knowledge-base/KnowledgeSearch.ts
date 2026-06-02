/**
 * KnowledgeSearch — hybrid search engine combining keyword (FTS5),
 * embedding (cosine similarity), entity graph, and weighted fusion.
 */

import { EventEmitter } from 'events';

import type {
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeSearchOptions,
  KnowledgeSearchQuery,
  Entity,
} from './types';
import { KnowledgeStore } from './KnowledgeStore';
import { EmbeddingEngine } from './EmbeddingEngine';
import { EntityExtractor } from './EntityExtractor';

// ── Types ───────────────────────────────────────────────────────────────────

export interface KnowledgeSearchConfig {
  /** Weight for keyword match score in hybrid search (0-1). */
  keywordWeight?: number;
  /** Weight for embedding match score in hybrid search (0-1). */
  embeddingWeight?: number;
  /** Minimum score threshold to include a result (0-1). */
  minScore?: number;
}

const DEFAULT_CONFIG: Required<KnowledgeSearchConfig> = {
  keywordWeight: 0.4,
  embeddingWeight: 0.6,
  minScore: 0.1,
};

// ── KnowledgeSearch Implementation ──────────────────────────────────────────

export class HybridSearchEngine extends EventEmitter {
  private store: KnowledgeStore;
  private embedder: EmbeddingEngine;
  private extractor: EntityExtractor;
  private config: Required<KnowledgeSearchConfig>;

  constructor(
    store: KnowledgeStore,
    embedder: EmbeddingEngine,
    config: KnowledgeSearchConfig = {}
  ) {
    super();
    this.store = store;
    this.embedder = embedder;
    this.extractor = new EntityExtractor();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Keyword Search (FTS5) ──────────────────────────────────────────────

  /**
   * Search documents by keyword matching.
   * Uses in-memory text matching; delegates to FTS5 when an adapter is present.
   */
  async searchByKeywords(
    query: KnowledgeSearchQuery,
    options: KnowledgeSearchOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    const keywords = query.keywords ?? [];
    if (keywords.length === 0) return [];

    const ftsQuery = this.store.buildFTSQuery(keywords.join(' '));
    const docs = await this.store.search(ftsQuery.raw, {
      limit: options.limit,
      source: options.source,
    });

    return docs.map((doc) => {
      const score = this.computeKeywordScore(doc, keywords);
      return {
        document: doc,
        score,
        matchType: 'keyword' as const,
        snippet: this.buildSnippet(doc.content, keywords),
      };
    })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 50);
  }

  // ── Embedding Search (Cosine Similarity) ───────────────────────────────

  /**
   * Search documents by embedding vector similarity.
   */
  async searchByEmbedding(
    query: KnowledgeSearchQuery,
    options: KnowledgeSearchOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    const queryEmbedding = query.embedding;
    if (!queryEmbedding || queryEmbedding.length === 0) {
      // Generate embedding from keywords if no explicit vector provided
      if (query.keywords && query.keywords.length > 0) {
        const embedQuery = query.keywords.join(' ');
        return this.searchByEmbeddingText(embedQuery, options);
      }
      return [];
    }

    const docs = await this.store.list(0, options.limit ?? 200);
    const source = options.source;

    const results: KnowledgeSearchResult[] = [];

    for (const doc of docs) {
      if (source && doc.source !== source) continue;

      const docEmbedding = doc.metadata.embedding;
      if (!docEmbedding || docEmbedding.length === 0) continue;

      const score = this.embedder.cosineSimilarity(queryEmbedding, docEmbedding);
      if (score < this.config.minScore) continue;

      results.push({
        document: doc,
        score,
        matchType: 'embedding',
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 50);
  }

  // ── Hybrid Search (Weighted Fusion) ────────────────────────────────────

  /**
   * Hybrid search — combine keyword and embedding scores with configurable weights.
   */
  async searchHybrid(
    query: KnowledgeSearchQuery,
    options: KnowledgeSearchOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    const mergedOptions: KnowledgeSearchOptions = { ...options, limit: undefined };

    // Run both searches in parallel with generous limits
    const [keywordResults, embeddingResults] = await Promise.all([
      this.searchByKeywords(query, { ...mergedOptions, limit: 200 }),
      this.searchByEmbedding(query, { ...mergedOptions, limit: 200 }),
    ]);

    // Build a map of document ID → fused score
    const fused = new Map<string, { doc: KnowledgeDocument; keywordScore: number; embeddingScore: number }>();

    for (const r of keywordResults) {
      fused.set(r.document.id, { doc: r.document, keywordScore: r.score, embeddingScore: 0 });
    }

    for (const r of embeddingResults) {
      const existing = fused.get(r.document.id);
      if (existing) {
        existing.embeddingScore = r.score;
      } else {
        fused.set(r.document.id, { doc: r.document, keywordScore: 0, embeddingScore: r.score });
      }
    }

    const results: KnowledgeSearchResult[] = [];
    for (const { doc, keywordScore, embeddingScore } of fused.values()) {
      const kw = keywordScore * this.config.keywordWeight;
      const emb = embeddingScore * this.config.embeddingWeight;
      const score = kw + emb;

      if (score < this.config.minScore) continue;

      results.push({
        document: doc,
        score,
        matchType: 'hybrid',
        snippet: keywordScore > embeddingScore
          ? this.buildSnippet(doc.content, query.keywords ?? [])
          : undefined,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 50);
  }

  // ── Entity Search (Graph Query) ────────────────────────────────────────

  /**
   * Search documents by entity graph traversal.
   * Finds documents whose entities match the given names, then expands
   * to related documents via entity relations.
   */
  async searchByEntity(
    query: KnowledgeSearchQuery,
    options: KnowledgeSearchOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    const entityNames = query.entities;
    if (!entityNames || entityNames.length === 0) return [];

    const docs = await this.store.list(0, 1000);
    const source = options.source;

    // Phase 1: Direct match — documents containing the named entities
    const directMatches: KnowledgeSearchResult[] = [];

    for (const doc of docs) {
      if (source && doc.source !== source) continue;

      const docEntityNames = doc.metadata.entities.map((e: Entity) => e.name.toLowerCase());
      const matched = entityNames.filter((en) =>
        docEntityNames.some((den) => den.includes(en.toLowerCase()))
      );

      if (matched.length > 0) {
        directMatches.push({
          document: doc,
          score: matched.length / entityNames.length,
          matchType: 'entity',
        });
      }
    }

    // Phase 2: Graph expansion — find related documents through entity relations
    const relatedEntities = new Set<string>();
    for (const doc of docs) {
      for (const entity of doc.metadata.entities) {
        if (entityNames.some((en) => entity.name.toLowerCase().includes(en.toLowerCase()))) {
          for (const rel of entity.relations) {
            relatedEntities.add(rel.target);
          }
        }
      }
    }

    const expandedMatches: KnowledgeSearchResult[] = [];

    if (relatedEntities.size > 0) {
      for (const doc of docs) {
        if (source && doc.source !== source) continue;
        if (directMatches.some((m) => m.document.id === doc.id)) continue;

        const docEntityNames = doc.metadata.entities.map((e: Entity) => e.name.toLowerCase());
        const matched = Array.from(relatedEntities).filter((re) =>
          docEntityNames.some((den) => den.includes(re.toLowerCase()))
        );

        if (matched.length > 0) {
          expandedMatches.push({
            document: doc,
            score: 0.3 * (matched.length / relatedEntities.size), // Decay expansion score
            matchType: 'entity',
          });
        }
      }
    }

    const results = [...directMatches, ...expandedMatches]
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 50);

    return results;
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  private async searchByEmbeddingText(
    text: string,
    options: KnowledgeSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    const embedding = await this.embedder.provider.embed(text);
    return this.searchByEmbedding({ embedding }, options);
  }

  /**
   * Compute a keyword relevance score for a document.
   */
  private computeKeywordScore(doc: KnowledgeDocument, keywords: string[]): number {
    const searchText = `${doc.title} ${doc.content} ${doc.metadata.tags.join(' ')}`.toLowerCase();
    let score = 0;

    for (const kw of keywords) {
      const lower = kw.toLowerCase();
      const count = (searchText.match(new RegExp(lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
      if (count > 0) {
        // Title matches are weighted higher
        const inTitle = doc.title.toLowerCase().includes(lower) ? 2 : 1;
        const inTags = doc.metadata.tags.some((t) => t.toLowerCase().includes(lower)) ? 1.5 : 1;
        score += (count * inTitle * inTags) / searchText.length;
      }
    }

    return Math.min(score * 100, 1); // Normalise to 0-1
  }

  /**
   * Build a snippet around keyword matches.
   */
  private buildSnippet(content: string, keywords: string[]): string | undefined {
    if (keywords.length === 0) return undefined;

    const lower = content.toLowerCase();
    const firstMatch = keywords
      .map((kw) => lower.indexOf(kw.toLowerCase()))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);

    if (firstMatch.length === 0) return undefined;

    const start = Math.max(0, firstMatch[0] - 80);
    const end = Math.min(content.length, firstMatch[0] + 120);

    let snippet = content.slice(start, end);
    if (start > 0) snippet = `…${snippet}`;
    if (end < content.length) snippet = `${snippet}…`;

    return snippet;
  }
}
