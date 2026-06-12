/**
 * Knowledge Base feature — barrel exports.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type {
  ContentType,
  ConversationMessage,
  DocumentChunk,
  Entity,
  EntityRelation,
  EntityType,
  FTSQuery,
  FTSResult,
  IngestionResult,
  IngestionSummary,
  KnowledgeDocument,
  KnowledgeDocumentMetadata,
  KnowledgeSearchOptions,
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
  KnowledgeSource,
  ResearchResult,
} from './types';

// ── Store ───────────────────────────────────────────────────────────────────

export type {
  KnowledgeStoreEvent,
  KnowledgeStoreEventType,
  KnowledgeStoreOptions,
  SQLiteAdapter,
} from './KnowledgeStore';
export { KnowledgeStore } from './KnowledgeStore';

// ── Embedding Engine ────────────────────────────────────────────────────────

export type {
  EmbeddingEngineOptions,
  EmbeddingProvider,
  LocalHashingProviderOptions,
  OllamaProviderOptions,
  TransformersProviderOptions,
} from './EmbeddingEngine';
export {
  EmbeddingEngine,
  LocalHashingProvider,
  NoOpProvider,
  OllamaProvider,
  TransformersProvider,
} from './EmbeddingEngine';

// ── Document Processor ──────────────────────────────────────────────────────

export type {
  ChunkingStrategy,
  DocumentProcessorOptions,
} from './DocumentProcessor';
export { DocumentProcessor } from './DocumentProcessor';

// ── Ingestors ───────────────────────────────────────────────────────────────

export type {
  ConversationIngestorEvent,
  ConversationIngestorEventType,
  ConversationIngestorOptions,
} from './ConversationIngestor';
export { ConversationIngestor } from './ConversationIngestor';
export type {
  ResearchIngestorEvent,
  ResearchIngestorEventType,
  ResearchIngestorOptions,
} from './ResearchIngestor';
export { ResearchIngestor } from './ResearchIngestor';

// ── Entity Extractor ────────────────────────────────────────────────────────

export type {
  EntityExtractorOptions,
  ExtractedEntity,
} from './EntityExtractor';
export { EntityExtractor } from './EntityExtractor';

// ── Knowledge Search ────────────────────────────────────────────────────────

export type {
  KnowledgeSearchConfig,
} from './KnowledgeSearch';
export { HybridSearchEngine } from './KnowledgeSearch';
