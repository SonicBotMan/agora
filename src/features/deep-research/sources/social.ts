/**
 * Social media search adapter (stub implementation).
 * Replace with actual social media API integration (e.g., Twitter/X, Reddit, LinkedIn).
 */

import type { SearchResult, SearchSourceAdapter } from './index';

export class SocialSearchAdapter implements SearchSourceAdapter {
  readonly sourceType = 'social' as const;

  async search(query: string, _limit = 10): Promise<SearchResult> {
    // TODO: Integrate with social media search API
    console.warn(`SocialSearchAdapter.search() not implemented — called with: ${query}`);
    return {
      findings: [],
      sourceMetadata: [],
    };
  }
}
