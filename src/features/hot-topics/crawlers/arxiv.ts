/**
 * arXiv crawler — fetches recent papers from arXiv API.
 */

import type { CrawlResult, CrawlerOptions, TopicItem } from '../types';

const ARXIV_QUERY_URL = 'https://export.arxiv.org/api/query';

export class ArxivCrawler {
  private options: Required<CrawlerOptions>;

  constructor(options: CrawlerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 15_000,
      maxRetries: options.maxRetries ?? 3,
      userAgent: options.userAgent ?? 'Agora-HotTopics/1.0',
    };
  }

  async fetch(config?: Record<string, unknown>): Promise<CrawlResult> {
    const now = new Date().toISOString();

    try {
      const categories = (config?.categories as string[]) ?? ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.SE'];
      const searchQuery = categories.map(c => `cat:${c}`).join('+OR+');
      const url = `${ARXIV_QUERY_URL}?search_query=${searchQuery}&sortBy=submittedDate&sortOrder=descending&max_results=30`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.options.timeout),
        headers: { 'User-Agent': this.options.userAgent },
      });

      if (!res.ok) {
        throw new Error(`arXiv API returned ${res.status}`);
      }

      const xml = await res.text();
      const topics = this.parseAtomFeed(xml);

      return {
        source: 'arxiv',
        topics,
        fetchedAt: now,
      };
    } catch (err) {
      return {
        source: 'arxiv',
        topics: [],
        fetchedAt: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── XML Parsing (lightweight) ────────────────────────────────────────────

  private parseAtomFeed(xml: string): TopicItem[] {
    const topics: TopicItem[] = [];

    // Simple regex-based extraction (in production use cheerio or xml2js)
    const entryRegex = /<entry>[\s\S]*?<\/entry>/g;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[0];
      const id = this.extractTag(entry, 'id')?.trim() ?? '';
      const title = this.unescapeXml(this.extractTag(entry, 'title')?.trim() ?? 'Untitled');
      const summary = this.unescapeXml(this.extractTag(entry, 'summary')?.trim()?.slice(0, 200) ?? '');
      const published = this.extractTag(entry, 'published')?.trim() ?? now;
      const link = this.extractLink(entry);
      const arxivId = id.split('/').pop()?.split('v')[0] ?? id;

      topics.push({
        id: `arxiv-${arxivId}`,
        title,
        summary,
        source: 'arxiv',
        url: link,
        score: 50, // arXiv doesn't provide engagement scores
        category: this.guessCategory(title),
        discoveredAt: new Date(published).toISOString(),
        tags: ['arxiv', 'research', ...this.extractTags(title)],
      });
    }

    return topics;
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's');
    const m = regex.exec(xml);
    return m ? m[1] : null;
  }

  private extractLink(xml: string): string {
    // Prefer the arXiv abstract link
    const m = /<link[^>]*href="([^"]+)"[^>]*\/>/.exec(xml);
    return m ? m[1] : '';
  }

  private unescapeXml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private guessCategory(title: string): TopicItem['category'] {
    const t = title.toLowerCase();
    if (/language model|llm|gpt|transformer|attention/i.test(t)) return 'ai';
    if (/learning|neural|deep|reinforcement|gan/i.test(t)) return 'ai';
    if (/protein|genome|bio|chemistry/i.test(t)) return 'science';
    if (/health|medical|clinical/i.test(t)) return 'health';
    if (/quantum/i.test(t)) return 'science';
    return 'tech';
  }

  private extractTags(title: string): string[] {
    const tags: string[] = [];
    const t = title.toLowerCase();
    if (/survey|review/i.test(t)) tags.push('survey');
    if (/large language model|llm/.test(t)) tags.push('llm');
    if (/benchmark|evaluation/.test(t)) tags.push('benchmark');
    return tags;
  }
}

const now = new Date().toISOString();
