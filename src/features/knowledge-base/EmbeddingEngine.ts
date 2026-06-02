/**
 * EmbeddingEngine — vector embedding provider abstraction.
 *
 * Supports Ollama (local), Transformers.js (in-browser), and NoOp (keyword-only).
 */

import type { KnowledgeDocument } from './types';

// ── EmbeddingProvider Interface ─────────────────────────────────────────────

export interface EmbeddingProvider {
  /** Embed a single text string into a vector. */
  embed(text: string): Promise<number[]>;

  /** Embed multiple texts in a batch. */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Human-readable provider name. */
  readonly name: string;

  /** Dimension of the embedding vectors. */
  readonly dimensions: number;
}

// ── OllamaProvider ──────────────────────────────────────────────────────────

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
}

/**
 * Ollama embedding provider (skeleton).
 * Connects to a local Ollama instance at localhost:11434.
 */
export class OllamaProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  readonly dimensions = 768; // nomic-embed-text default
  private baseUrl: string;
  private model: string;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:11434';
    this.model = options.model ?? 'nomic-embed-text';
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

// ── TransformersProvider ────────────────────────────────────────────────────

export interface TransformersProviderOptions {
  model?: string;
}

/**
 * Transformers.js embedding provider (skeleton).
 * Uses the transformers.js library for in-browser / Node.js embedding.
 */
export class TransformersProvider implements EmbeddingProvider {
  readonly name = 'transformers';
  readonly dimensions = 384; // all-MiniLM-L6-v2 default
  private modelName: string;
  private pipeline: unknown = null;

  constructor(options: TransformersProviderOptions = {}) {
    this.modelName = options.model ?? 'Xenova/all-MiniLM-L6-v2';
  }

  async embed(text: string): Promise<number[]> {
    // Skeleton: would use transformers.js pipeline('feature-extraction', modelName)
    // For now, return a mock zero vector of the correct dimension
    void this.modelName;
    void this.pipeline;
    return new Array(this.dimensions).fill(0);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(this.dimensions).fill(0));
  }
}

// ── NoOpProvider ────────────────────────────────────────────────────────────

/**
 * NoOp embedding provider — skips vectorisation entirely.
 * Use when only keyword/FTS search is needed.
 */
export class NoOpProvider implements EmbeddingProvider {
  readonly name = 'noop';
  readonly dimensions = 0;

  async embed(_text: string): Promise<number[]> {
    return [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}

// ── Embedding Engine ────────────────────────────────────────────────────────

export interface EmbeddingEngineOptions {
  provider?: EmbeddingProvider;
}

/**
 * High-level embedding engine that manages document vectorisation.
 */
export class EmbeddingEngine {
  readonly provider: EmbeddingProvider;

  constructor(options: EmbeddingEngineOptions = {}) {
    this.provider = options.provider ?? new NoOpProvider();
  }

  /**
   * Generate an embedding for a single document.
   * Returns the document with its metadata.embedding populated.
   */
  async embedDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    const embedding = await this.provider.embed(doc.content);
    return {
      ...doc,
      metadata: {
        ...doc.metadata,
        embedding,
      },
    };
  }

  /**
   * Generate embeddings for multiple documents in batch.
   */
  async embedDocuments(docs: KnowledgeDocument[]): Promise<KnowledgeDocument[]> {
    const contents = docs.map((d) => d.content);
    const embeddings = await this.provider.embedBatch(contents);

    return docs.map((doc, i) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        embedding: embeddings[i] ?? [],
      },
    }));
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
