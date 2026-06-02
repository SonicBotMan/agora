/**
 * Web search adapter (stub implementation).
 * Replace with actual web search API integration.
 */

import type { SearchResult, SearchSourceAdapter } from './index';

export class WebSearchAdapter implements SearchSourceAdapter {
  readonly sourceType = 'web' as const;

  async search(query: string, _limit = 10): Promise<SearchResult> {
    // TODO: Integrate with web search API (e.g., SerpAPI, Bing, Google)
    console.warn(`WebSearchAdapter.search() not implemented — called with: ${query}`);
    return {
      findings: [],
      sourceMetadata: [],
    };
  }
}
