/**
 * Knowledge Base feature — barrel exports.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type {
  KnowledgeSource,
  ContentType,
  EntityType,
  EntityRelation,
  Entity,
  KnowledgeDocumentMetadata,
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeSearchOptions,
  KnowledgeSearchQuery,
  IngestionResult,
  IngestionSummary,
  ConversationMessage,
  ResearchResult,
  DocumentChunk,
  FTSQuery,
  FTSResult,
} from './types';

// ── Store ───────────────────────────────────────────────────────────────────

export { KnowledgeStore } from './KnowledgeStore';
export type {
  SQLiteAdapter,
  KnowledgeStoreEventType,
  KnowledgeStoreEvent,
  KnowledgeStoreOptions,
} from './KnowledgeStore';

// ── Embedding Engine ────────────────────────────────────────────────────────

export { EmbeddingEngine, OllamaProvider, TransformersProvider, NoOpProvider } from './EmbeddingEngine';
export type {
  EmbeddingProvider,
  OllamaProviderOptions,
  TransformersProviderOptions,
  EmbeddingEngineOptions,
} from './EmbeddingEngine';

// ── Document Processor ──────────────────────────────────────────────────────

export { DocumentProcessor } from './DocumentProcessor';
export type {
  ChunkingStrategy,
  DocumentProcessorOptions,
} from './DocumentProcessor';

// ── Ingestors ───────────────────────────────────────────────────────────────

export { ConversationIngestor } from './ConversationIngestor';
export type {
  ConversationIngestorOptions,
  ConversationIngestorEventType,
  ConversationIngestorEvent,
} from './ConversationIngestor';

export { ResearchIngestor } from './ResearchIngestor';
export type {
  ResearchIngestorOptions,
  ResearchIngestorEventType,
  ResearchIngestorEvent,
} from './ResearchIngestor';

// ── Entity Extractor ────────────────────────────────────────────────────────

export { EntityExtractor } from './EntityExtractor';
export type {
  EntityExtractorOptions,
  ExtractedEntity,
} from './EntityExtractor';

// ── Knowledge Search ────────────────────────────────────────────────────────

export { HybridSearchEngine } from './KnowledgeSearch';
export type {
  KnowledgeSearchConfig,
} from './KnowledgeSearch';
