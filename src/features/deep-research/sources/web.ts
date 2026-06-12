import type { SearchResult, SearchSourceAdapter } from './index';

export class WebSearchAdapter implements SearchSourceAdapter {
  readonly sourceType = 'web' as const;

  async search(query: string, limit = 10): Promise<SearchResult> {
    const now = new Date().toISOString();
    const endpoint = new URL('https://en.wikipedia.org/w/api.php');
    endpoint.searchParams.set('action', 'query');
    endpoint.searchParams.set('list', 'search');
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('origin', '*');
    endpoint.searchParams.set('utf8', '1');
    endpoint.searchParams.set('srsearch', query);
    endpoint.searchParams.set('srlimit', String(Math.max(1, Math.min(limit, 20))));

    try {
      const response = await fetch(endpoint, {
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Wikipedia search failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as WikipediaSearchResponse;
      const findings = (data.query?.search ?? []).map((item, index) => {
        const url = item.pageid
          ? `https://en.wikipedia.org/?curid=${item.pageid}`
          : `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`;
        const source = {
          url,
          title: item.title,
          type: this.sourceType,
          retrievedAt: now,
        };

        return {
          source,
          title: item.title,
          snippet: cleanSnippet(item.snippet),
          url,
          relevanceScore: normalizeRank(index),
        };
      });

      return {
        findings,
        sourceMetadata: findings.map((finding) => finding.source),
      };
    } catch (error) {
      console.warn(
        `[WebSearchAdapter] Search failed for "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        findings: [],
        sourceMetadata: [],
      };
    }
  }
}

interface WikipediaSearchResponse {
  query?: {
    search?: Array<{
      pageid?: number;
      title: string;
      snippet: string;
    }>;
  };
}

function normalizeRank(index: number): number {
  return Math.max(0.2, Math.round((1 - index * 0.08) * 100) / 100);
}

function cleanSnippet(snippet: string): string {
  return decodeHtml(snippet)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
