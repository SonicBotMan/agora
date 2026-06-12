import { ipcMain } from 'electron';

import type {
  ContentType,
  HybridSearchEngine,
  KnowledgeDocument,
  KnowledgeSearchOptions,
  KnowledgeSource,
  KnowledgeStore,
} from '../../features/knowledge-base';

type KnowledgeSearchMode = 'keyword' | 'embedding' | 'hybrid' | 'entity';

export interface KnowledgeSearchRequest extends KnowledgeSearchOptions {
  mode?: KnowledgeSearchMode;
}

export interface KnowledgeDocumentInput {
  id?: string;
  title: string;
  source: KnowledgeSource;
  sourceId?: string;
  content: string;
  contentType: ContentType;
  metadata?: Partial<KnowledgeDocument['metadata']>;
}

export interface KnowledgeDeps {
  getKnowledgeStore: () => KnowledgeStore;
  getKnowledgeSearchEngine: () => HybridSearchEngine;
}

export function registerKnowledgeHandlers(deps: KnowledgeDeps): void {
  ipcMain.handle(
    'knowledge:search',
    async (_event, query: string, options: KnowledgeSearchRequest = {}) => {
      try {
        const keywords = query
          .split(/\s+/)
          .map((keyword) => keyword.trim())
          .filter(Boolean);
        const searchOptions: KnowledgeSearchOptions = {
          limit: options.limit == null
            ? undefined
            : (options.offset ?? 0) + options.limit,
          source: options.source,
          tags: options.tags,
        };

        let results;
        switch (options.mode) {
          case 'keyword':
            results = await deps.getKnowledgeSearchEngine().searchByKeywords(
              { keywords },
              searchOptions,
            );
            break;
          case 'embedding':
            results = await deps.getKnowledgeSearchEngine().searchByEmbedding(
              { keywords },
              searchOptions,
            );
            break;
          case 'entity':
            results = await deps.getKnowledgeSearchEngine().searchByEntity(
              { entities: keywords },
              searchOptions,
            );
            break;
          default:
            results = await deps.getKnowledgeSearchEngine().searchHybrid(
              { keywords },
              searchOptions,
            );
            break;
        }

        const filtered = filterResultsByTags(results, options.tags);
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 50;

        return {
          success: true,
          total: filtered.length,
          results: filtered.slice(offset, offset + limit),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to search knowledge base',
        };
      }
    },
  );

  ipcMain.handle('knowledge:get', async (_event, id: string) => {
    try {
      return {
        success: true,
        document: await deps.getKnowledgeStore().get(id),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get knowledge document',
      };
    }
  });

  ipcMain.handle(
    'knowledge:list',
    async (_event, offset = 0, limit = 50) => {
      try {
        return {
          success: true,
          documents: await deps.getKnowledgeStore().list(offset, limit),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to list knowledge documents',
        };
      }
    },
  );

  ipcMain.handle('knowledge:delete', async (_event, id: string) => {
    try {
      return {
        success: true,
        deleted: await deps.getKnowledgeStore().delete(id),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to delete knowledge document',
      };
    }
  });

  ipcMain.handle(
    'knowledge:add',
    async (_event, input: KnowledgeDocumentInput) => {
      try {
        const document = normalizeKnowledgeDocument(input);
        await deps.getKnowledgeStore().save(document);

        return {
          success: true,
          document,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to add knowledge document',
        };
      }
    },
  );
}

function normalizeKnowledgeDocument(input: KnowledgeDocumentInput): KnowledgeDocument {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    source: input.source,
    sourceId: input.sourceId,
    content: input.content,
    contentType: input.contentType,
    metadata: {
      tags: [...new Set(input.metadata?.tags ?? [])],
      entities: input.metadata?.entities ?? [],
      embedding: input.metadata?.embedding,
      createdAt: input.metadata?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

function filterResultsByTags<
  T extends {
    document: {
      metadata: {
        tags: string[];
      };
    };
  },
>(
  results: T[],
  tags?: string[],
): T[] {
  if (!tags || tags.length === 0) {
    return results;
  }

  return results.filter((result) =>
    tags.every((tag) => result.document.metadata.tags.includes(tag)),
  );
}
