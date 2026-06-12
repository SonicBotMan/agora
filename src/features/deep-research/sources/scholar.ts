import type { SearchResult, SearchSourceAdapter } from './index';

export class ScholarSearchAdapter implements SearchSourceAdapter {
  readonly sourceType = 'scholar' as const;

  async search(query: string, limit = 10): Promise<SearchResult> {
    const endpoint = new URL('https://export.arxiv.org/api/query');
    endpoint.searchParams.set('search_query', `all:${query}`);
    endpoint.searchParams.set('start', '0');
    endpoint.searchParams.set('max_results', String(Math.max(1, Math.min(limit, 10))));

    try {
      const response = await fetch(endpoint, {
        headers: {
          accept: 'application/atom+xml',
        },
      });

      if (!response.ok) {
        throw new Error(`arXiv search failed: ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      const findings = extractEntries(xml).map((entry, index) => {
        const source = {
          url: entry.id,
          title: entry.title,
          type: this.sourceType,
          retrievedAt: entry.published ?? new Date().toISOString(),
        };

        return {
          source,
          title: entry.title,
          snippet: entry.summary,
          url: entry.id,
          relevanceScore: normalizeRank(index),
        };
      });

      return {
        findings,
        sourceMetadata: findings.map((finding) => finding.source),
      };
    } catch (error) {
      console.warn(
        `[ScholarSearchAdapter] Search failed for "${query}": ${
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

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  published?: string;
}

function extractEntries(xml: string): ArxivEntry[] {
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g), (match) => {
    const block = match[1];
    return {
      id: extractTag(block, 'id'),
      title: normalizeText(extractTag(block, 'title')),
      summary: normalizeText(extractTag(block, 'summary')),
      published: extractTag(block, 'published') || undefined,
    };
  }).filter((entry) => Boolean(entry.id) && Boolean(entry.title));
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.trim() ?? '';
}

function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function normalizeRank(index: number): number {
  return Math.max(0.25, Math.round((1 - index * 0.08) * 100) / 100);
}
