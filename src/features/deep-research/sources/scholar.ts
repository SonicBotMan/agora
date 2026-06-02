/**
 * Scholar/Academic search adapter (stub implementation).
 * Replace with actual academic search API integration (e.g., Semantic Scholar, Google Scholar, arXiv).
 */

import type { SearchResult, SearchSourceAdapter } from './index';

export class ScholarSearchAdapter implements SearchSourceAdapter {
  readonly sourceType = 'scholar' as const;

  async search(query: string, _limit = 10): Promise<SearchResult> {
    // TODO: Integrate with academic search API (e.g., Semantic Scholar, arXiv API)
    console.warn(`ScholarSearchAdapter.search() not implemented — called with: ${query}`);
    return {
      findings: [],
      sourceMetadata: [],
    };
  }
}
