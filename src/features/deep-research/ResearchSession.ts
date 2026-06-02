/**
 * Research session manager.
 * Handles creation, retrieval, listing, and cancellation of research sessions.
 */

import type { ResearchQuery, ResearchResult } from './types';
import { ResearchEngine } from './ResearchEngine';

export interface ResearchSessionRecord {
  id: string;
  query: ResearchQuery;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  result: ResearchResult | null;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export class ResearchSession {
  private sessions: Map<string, ResearchSessionRecord> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private engine: ResearchEngine;

  constructor() {
    this.engine = new ResearchEngine();
  }

  /**
   * Create and start a new research session.
   */
  create(query: ResearchQuery): ResearchSessionRecord {
    const id = this.generateId();
    const now = new Date().toISOString();

    const record: ResearchSessionRecord = {
      id,
      query,
      status: 'running',
      result: null,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(id, record);
    this.startExecution(id, query);

    return record;
  }

  /**
   * Get a session record by ID.
   */
  get(id: string): ResearchSessionRecord | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all session records.
   */
  list(): ResearchSessionRecord[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Cancel an active research session.
   */
  cancel(id: string): boolean {
    const record = this.sessions.get(id);
    if (!record || record.status !== 'running') {
      return false;
    }

    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    record.status = 'cancelled';
    record.updatedAt = new Date().toISOString();
    return true;
  }

  private generateId(): string {
    return `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async startExecution(id: string, query: ResearchQuery): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(id, controller);

    try {
      // Iterate through the async generator to drive the research
      const generator = this.engine.research(query);
      let result: ResearchResult | null = null;

      for await (const event of generator) {
        if (controller.signal.aborted) {
          return;
        }

        if (event.type === 'saved') {
          result = event.result;
        }
      }

      // Update the session record when complete
      const record = this.sessions.get(id);
      if (record) {
        record.status = result ? 'completed' : 'error';
        record.result = result;
        record.updatedAt = new Date().toISOString();
      }
    } catch (err) {
      const record = this.sessions.get(id);
      if (record) {
        record.status = 'error';
        record.error = err instanceof Error ? err.message : String(err);
        record.updatedAt = new Date().toISOString();
      }
    } finally {
      this.abortControllers.delete(id);
    }
  }
}
