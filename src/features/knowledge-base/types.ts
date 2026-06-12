/**
 * Type definitions for the Knowledge Base feature.
 */

// ── Source Types ────────────────────────────────────────────────────────────

export type KnowledgeSource = 'conversation' | 'research' | 'manual' | 'hot-topic';

export type ContentType = 'markdown' | 'text' | 'html' | 'json';

export type EntityType = 'person' | 'org' | 'concept' | 'tool' | 'tech';

// ── Entity ──────────────────────────────────────────────────────────────────

export interface EntityRelation {
  target: string;
  type: string;
}

export interface Entity {
  name: string;
  type: EntityType;
  relations: EntityRelation[];
}

// ── Knowledge Document ──────────────────────────────────────────────────────

export interface KnowledgeDocumentMetadata {
  tags: string[];
  entities: Entity[];
  embedding?: number[];
  createdAt: string;      // ISO-8601
  updatedAt: string;      // ISO-8601
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: KnowledgeSource;
  sourceId?: string;
  content: string;
  contentType: ContentType;
  metadata: KnowledgeDocumentMetadata;
}

// ── Knowledge Search ────────────────────────────────────────────────────────

export interface KnowledgeSearchResult {
  document: KnowledgeDocument;
  score: number;          // 0-1 relevance score
  matchType: 'keyword' | 'embedding' | 'hybrid' | 'entity';
  snippet?: string;       // highlighted excerpt
}

export interface KnowledgeSearchOptions {
  limit?: number;
  offset?: number;
  source?: KnowledgeSource;
  tags?: string[];
}

export interface KnowledgeSearchQuery {
  keywords?: string[];
  embedding?: number[];
  entities?: string[];    // entity names
  hybridWeight?: number;  // 0 = pure keyword, 1 = pure embedding
}

// ── Ingestion ───────────────────────────────────────────────────────────────

export interface IngestionResult {
  success: boolean;
  documentId: string;
  title: string;
  chunks: number;
  entities: Entity[];
  error?: string;
}

export interface IngestionSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: IngestionResult[];
}

// ── Conversation Ingestion ──────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// ── Research Ingestion ──────────────────────────────────────────────────────

export type ResearchResult = import('../deep-research/types').ResearchResult;

// ── Document Chunk ──────────────────────────────────────────────────────────

export interface DocumentChunk {
  id: string;
  documentId: string;
  title: string;
  content: string;
  heading?: string;
  index: number;
  metadata: KnowledgeDocumentMetadata;
}

// ── FTS ─────────────────────────────────────────────────────────────────────

export interface FTSQuery {
  raw: string;
  terms: string[];
  prefix?: boolean;
}

export interface FTSResult {
  rowid: number;
  documentId: string;
  rank: number;
  snippet?: string;
}
