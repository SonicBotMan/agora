import type {
  ContentType,
  KnowledgeDocument,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  KnowledgeSource,
} from '../../features/knowledge-base';

export interface KnowledgeSearchRequest extends KnowledgeSearchOptions {
  mode?: 'keyword' | 'embedding' | 'hybrid' | 'entity';
}

export interface KnowledgeDocumentDraft {
  id?: string;
  title: string;
  source: KnowledgeSource;
  sourceId?: string;
  content: string;
  contentType: ContentType;
  metadata?: Partial<KnowledgeDocument['metadata']>;
}

class KnowledgeService {
  async search(
    query: string,
    options?: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResult[]> {
    try {
      return await window.electron.knowledge.search(query, options);
    } catch (error) {
      console.error('Failed to search knowledge base:', error);
      return [];
    }
  }

  async get(documentId: string): Promise<KnowledgeDocument | null> {
    try {
      return await window.electron.knowledge.get(documentId);
    } catch (error) {
      console.error('Failed to get knowledge document:', error);
      return null;
    }
  }

  async list(offset?: number, limit?: number): Promise<KnowledgeDocument[]> {
    try {
      return await window.electron.knowledge.list(offset, limit);
    } catch (error) {
      console.error('Failed to list knowledge documents:', error);
      return [];
    }
  }

  async delete(documentId: string): Promise<boolean> {
    try {
      return await window.electron.knowledge.delete(documentId);
    } catch (error) {
      console.error('Failed to delete knowledge document:', error);
      return false;
    }
  }

  async add(document: KnowledgeDocumentDraft): Promise<KnowledgeDocument | null> {
    try {
      return await window.electron.knowledge.add(document);
    } catch (error) {
      console.error('Failed to add knowledge document:', error);
      return null;
    }
  }
}

export const knowledgeService = new KnowledgeService();
