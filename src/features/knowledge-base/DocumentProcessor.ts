/**
 * DocumentProcessor — document ingestion and chunking.
 *
 * Processes markdown, plain-text, and HTML documents into structured
 * KnowledgeDocument arrays using configurable chunking strategies.
 */

import type { KnowledgeDocument, KnowledgeSource, DocumentChunk, ContentType } from './types';

// ── Chunking Strategy ───────────────────────────────────────────────────────

export type ChunkingStrategy = 'heading' | 'paragraph' | 'fixed-size';

export interface DocumentProcessorOptions {
  chunkingStrategy?: ChunkingStrategy;
  maxChunkSize?: number;        // chars, for fixed-size strategy
  defaultSource?: KnowledgeSource;
}

// ── DocumentProcessor ──────────────────────────────────────────────────────

export class DocumentProcessor {
  private options: Required<DocumentProcessorOptions>;

  constructor(options: DocumentProcessorOptions = {}) {
    this.options = {
      chunkingStrategy: options.chunkingStrategy ?? 'heading',
      maxChunkSize: options.maxChunkSize ?? 2000,
      defaultSource: options.defaultSource ?? 'manual',
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Process a markdown string into KnowledgeDocument chunks.
   */
  processMarkdown(
    content: string,
    meta: { title: string; source?: KnowledgeSource; tags?: string[] }
  ): KnowledgeDocument[] {
    const chunks = this.chunkByHeadings(content);
    return this.toDocuments(chunks, { ...meta, contentType: 'markdown' });
  }

  /**
   * Process a plain-text string into KnowledgeDocument chunks.
   */
  processText(
    content: string,
    meta: { title: string; source?: KnowledgeSource; tags?: string[] }
  ): KnowledgeDocument[] {
    const strategy = this.options.chunkingStrategy;

    let chunks: string[];
    if (strategy === 'paragraph') {
      chunks = this.chunkByParagraphs(content);
    } else {
      chunks = this.chunkFixedSize(content);
    }

    return this.toDocuments(chunks, { ...meta, contentType: 'text' });
  }

  /**
   * Process an HTML string into KnowledgeDocument chunks.
   */
  processHtml(
    html: string,
    meta: { title: string; source?: KnowledgeSource; tags?: string[] }
  ): KnowledgeDocument[] {
    // Skeleton: strip HTML tags before chunking
    const text = html.replace(/<[^>]*>/g, '');
    const chunks = this.chunkByParagraphs(text);
    return this.toDocuments(chunks, { ...meta, contentType: 'html' });
  }

  // ── Chunking Strategies ─────────────────────────────────────────────────

  /**
   * Split markdown content by headings (##, ###, etc.) or paragraphs.
   */
  chunkByHeadings(content: string): string[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const chunks: string[] = [];
    let lastIndex = 0;
    let lastHeading = '';

    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(content)) !== null) {
      // Save the previous section (from last heading to this one)
      if (lastIndex > 0 || lastHeading) {
        const section = content.slice(lastIndex, match.index).trim();
        if (section) {
          chunks.push(`${lastHeading}\n\n${section}`);
        }
      }

      lastIndex = match.index;
      lastHeading = match[0];
    }

    // Last section
    const tail = content.slice(lastIndex).trim();
    if (tail) {
      chunks.push(tail);
    }

    // If no headings found, fall back to paragraphs
    if (chunks.length === 0) {
      return this.chunkByParagraphs(content);
    }

    return chunks;
  }

  /**
   * Split content by double-newline paragraph boundaries.
   */
  chunkByParagraphs(content: string): string[] {
    return content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /**
   * Split content into fixed-size chunks.
   */
  chunkFixedSize(content: string): string[] {
    const maxSize = this.options.maxChunkSize;
    const chunks: string[] = [];

    for (let i = 0; i < content.length; i += maxSize) {
      chunks.push(content.slice(i, i + maxSize).trim());
    }

    return chunks.filter((c) => c.length > 0);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private toDocuments(
    chunks: string[],
    meta: {
      title: string;
      source?: KnowledgeSource;
      tags?: string[];
      contentType: ContentType;
    }
  ): KnowledgeDocument[] {
    const now = new Date().toISOString();
    const source = meta.source ?? this.options.defaultSource;

    return chunks.map((content, i) => ({
      id: `${this.slugify(meta.title)}-${i}`,
      title: i === 0 ? meta.title : `${meta.title} (part ${i + 1})`,
      source,
      content,
      contentType: meta.contentType,
      metadata: {
        tags: meta.tags ?? [],
        entities: [],
        createdAt: now,
        updatedAt: now,
      },
    }));
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // ── Chunk Access ────────────────────────────────────────────────────────

  /**
   * Extract chunk metadata from a document list.
   */
  getChunks(documents: KnowledgeDocument[]): DocumentChunk[] {
    return documents.map((doc, i) => ({
      id: `chunk-${doc.id}`,
      documentId: doc.id,
      title: doc.title,
      content: doc.content,
      index: i,
      metadata: doc.metadata,
    }));
  }
}
