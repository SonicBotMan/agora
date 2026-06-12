/**
 * EmbeddingEngine — vector embedding provider abstraction.
 *
 * Supports Ollama (local), Transformers.js, a lightweight local hashing
 * fallback, and NoOp (keyword-only).
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

// ── LocalHashingProvider ───────────────────────────────────────────────────

export interface LocalHashingProviderOptions {
  dimensions?: number;
}

/**
 * Lightweight deterministic embedding provider.
 *
 * Generates normalized vectors locally by hashing tokens and short character
 * n-grams into a fixed-size vector space. This is not model-quality semantic
 * embedding, but it provides stable offline similarity behavior and makes the
 * default knowledge-base experience usable without external services.
 */
export class LocalHashingProvider implements EmbeddingProvider {
  readonly name = 'local-hash';
  readonly dimensions: number;

  constructor(options: LocalHashingProviderOptions = {}) {
    this.dimensions = options.dimensions ?? 256;
  }

  async embed(text: string): Promise<number[]> {
    const tokens = collectEmbeddingTokens(text);
    if (tokens.length === 0) {
      return new Array(this.dimensions).fill(0);
    }

    const vector = new Array(this.dimensions).fill(0);
    const frequencies = new Map<string, number>();

    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }

    for (const [token, count] of frequencies) {
      const index = hashToken(token) % this.dimensions;
      const sign = (hashToken(`${token}:sign`) & 1) === 0 ? 1 : -1;
      const weight = 1 + Math.log(count);
      vector[index] += sign * weight;
    }

    normalizeVector(vector);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

// ── OllamaProvider ──────────────────────────────────────────────────────────

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
  timeout?: number;
  fetchImpl?: typeof fetch;
  normalizeOutput?: boolean;
}

/**
 * Ollama embedding provider.
 * Uses the batch `/api/embed` endpoint when available and falls back to the
 * legacy `/api/embeddings` prompt API for compatibility.
 */
export class OllamaProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  readonly dimensions = 768; // nomic-embed-text default
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private fetchImpl: typeof fetch;
  private normalizeOutput: boolean;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:11434';
    this.model = options.model ?? 'nomic-embed-text';
    this.timeout = options.timeout ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.normalizeOutput = options.normalizeOutput ?? true;
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.request(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    const data = (await response.json()) as { embedding?: unknown };
    return this.normalizeEmbedding(this.readSingleEmbedding(data.embedding));
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const response = await this.request(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: texts }),
      });
      const data = (await response.json()) as { embeddings?: unknown };
      return this.readBatchEmbeddings(data.embeddings).map((embedding) => this.normalizeEmbedding(embedding));
    } catch {
      return Promise.all(texts.map((text) => this.embed(text)));
    }
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama embed failed: ${response.status} ${response.statusText}`);
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  private readSingleEmbedding(value: unknown): number[] {
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'number')) {
      throw new Error('Ollama embed failed: invalid embedding payload');
    }
    return [...value];
  }

  private readBatchEmbeddings(value: unknown): number[][] {
    if (
      !Array.isArray(value)
      || !value.every((entry) => Array.isArray(entry) && entry.every((inner) => typeof inner === 'number'))
    ) {
      throw new Error('Ollama embed failed: invalid embeddings payload');
    }
    return value.map((entry) => [...entry]);
  }

  private normalizeEmbedding(vector: number[]): number[] {
    if (!this.normalizeOutput) {
      return vector;
    }

    normalizeVector(vector);
    return vector;
  }
}

// ── TransformersProvider ────────────────────────────────────────────────────

export interface TransformersProviderOptions {
  model?: string;
}

/**
 * Transformers.js embedding provider.
 * Uses a lightweight deterministic fallback until a heavyweight local model
 * pipeline is wired in.
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
    void this.modelName;
    void this.pipeline;
    return new LocalHashingProvider({
      dimensions: this.dimensions,
    }).embed(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
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
    return texts.map((): number[] => []);
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
    this.provider = options.provider ?? new LocalHashingProvider();
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

function collectEmbeddingTokens(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  const tokens: string[] = [];
  const lexicalTokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];

  for (const token of lexicalTokens) {
    if (token.length >= 2) {
      tokens.push(token);
    }
    if (token.length >= 4) {
      tokens.push(...buildNGrams(token, 3));
    }
  }

  const cjkSegments = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu) ?? [];
  for (const segment of cjkSegments) {
    tokens.push(segment);
    if (segment.length >= 2) {
      tokens.push(...buildNGrams(segment, 2));
    }
  }

  return tokens;
}

function buildNGrams(text: string, size: number): string[] {
  if (text.length < size) {
    return [];
  }

  const grams: string[] = [];
  for (let index = 0; index <= text.length - size; index += 1) {
    grams.push(text.slice(index, index + size));
  }
  return grams;
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeVector(vector: number[]): void {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (norm === 0) {
    return;
  }

  for (let index = 0; index < vector.length; index += 1) {
    vector[index] /= norm;
  }
}
