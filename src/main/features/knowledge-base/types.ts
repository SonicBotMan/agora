/**
 * Agora — Knowledge Base Types
 * Local knowledge base with FTS5 + optional vector search.
 */

export interface Entity {
  name: string;
  type: 'person' | 'org' | 'concept' | 'tool' | 'tech';
  relations: { target: string; relationType: string }[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: 'conversation' | 'research' | 'manual' | 'hot-topic';
  sourceId?: string;
  content: string;
  contentType: 'markdown' | 'text' | 'html';
  metadata: {
    tags: string[];
    entities: Entity[];
    embedding?: number[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface KnowledgeSearchResult {
  document: KnowledgeDocument;
  score: number;
  matchType: 'keyword' | 'semantic' | 'hybrid';
}

export interface KnowledgeSearchOptions {
  keywordWeight?: number;
  semanticWeight?: number;
  limit?: number;
  sourceFilter?: KnowledgeDocument['source'][];
}
