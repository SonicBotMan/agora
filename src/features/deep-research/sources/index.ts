/**
 * Unified search source adapter interface.
 * All source adapters (web, scholar, social) must implement this.
 */

import type { Finding, ResearchSourceType, Source } from '../types';

export interface SearchResult {
  findings: Finding[];
  sourceMetadata: Source[];
}

export interface SearchSourceAdapter {
  readonly sourceType: ResearchSourceType;

  search(query: string, limit?: number): Promise<SearchResult>;
}
