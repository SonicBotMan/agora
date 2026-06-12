/**
 * Daily digest generation and heuristic summary synthesis.
 */

import type { TopicDigest, TopicItem } from './types';

const GENERIC_TAGS = new Set([
  'arxiv',
  'custom',
  'hacker-news',
  'reddit',
  'research',
  'twitter',
  'weibo',
]);

export class TopicDigestGenerator {
  /**
   * Build a TopicDigest from a list of topics, sorted by score descending.
   */
  generateDigest(topics: TopicItem[]): TopicDigest {
    const sorted = [...topics].sort((a, b) => b.score - a.score);

    return {
      date: new Date().toISOString().slice(0, 10),
      topics: sorted,
    };
  }

  /**
   * Generate a deterministic narrative summary for the digest.
   */
  async summarizeWithAI(topics: TopicItem[]): Promise<string> {
    if (topics.length === 0) {
      return 'No hot topics discovered today.';
    }

    const sorted = [...topics].sort((left, right) => right.score - left.score);
    const topStories = sorted.slice(0, 5);
    const categoryCounts = this.countBy(topics, (topic) => topic.category);
    const sourceCounts = this.countBy(topics, (topic) => topic.source);
    const repeatedTags = this.collectTopTags(topics);
    const leaders = this.formatCounts(categoryCounts, 3, 'topics');
    const sources = this.formatCounts(sourceCounts, 3, 'items');
    const highMomentum = sorted.filter((topic) => topic.score >= 80);
    const leadTopic = sorted[0];

    const opening = this.buildOpening(topics, categoryCounts, sourceCounts, repeatedTags, leadTopic);
    const signalLines = [
      `- ${highMomentum.length} topic${highMomentum.length === 1 ? '' : 's'} scored 80 or above, led by **${leadTopic.title}** (${leadTopic.score}).`,
      repeatedTags.length > 0
        ? `- Cross-topic overlap is forming around ${repeatedTags.map((tag) => `\`${tag}\``).join(', ')}.`
        : `- Attention is dispersed, with the strongest signal still centered on **${leadTopic.title}**.`,
      `- The source mix is led by ${sources}.`,
    ];

    const topTitles = topStories
      .map((topic) => `- **${topic.title}** (${topic.category}, ${topic.score}) — ${this.truncate(topic.summary || topic.title, 120)}`)
      .join('\n');

    return [
      `## Daily Hot Topics Summary`,
      ``,
      `**Date:** ${new Date().toISOString().slice(0, 10)}`,
      `**Total topics:** ${topics.length}`,
      `**Leading categories:** ${leaders}`,
      ``,
      opening,
      ``,
      `### Signals to Watch`,
      ``,
      ...signalLines,
      ``,
      `### Top Stories`,
      ``,
      topTitles,
    ].join('\n');
  }

  private countBy(topics: TopicItem[], keyFn: (topic: TopicItem) => string): Map<string, number> {
    const counts = new Map<string, number>();

    for (const topic of topics) {
      const key = keyFn(topic);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }

  private formatCounts(counts: Map<string, number>, limit: number, noun: string): string {
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit)
      .map(([label, count]) => `${label} (${count} ${noun})`)
      .join(', ');
  }

  private collectTopTags(topics: TopicItem[]): string[] {
    const tagCounts = new Map<string, number>();

    for (const topic of topics) {
      for (const tag of topic.tags) {
        const normalized = tag.trim().toLowerCase();
        if (!normalized || normalized.length < 3 || GENERIC_TAGS.has(normalized)) {
          continue;
        }
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .filter(([, count]) => count > 1)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([tag]) => tag);
  }

  private buildOpening(
    topics: TopicItem[],
    categoryCounts: Map<string, number>,
    sourceCounts: Map<string, number>,
    repeatedTags: string[],
    leadTopic: TopicItem,
  ): string {
    const topCategory = this.firstKey(categoryCounts) ?? 'other';
    const topSource = this.firstKey(sourceCounts) ?? leadTopic.source;
    const repeatedTagText = repeatedTags.length > 0
      ? `Repeated attention is clustering around ${repeatedTags.map((tag) => `\`${tag}\``).join(', ')}.`
      : `The discussion is broad, but **${leadTopic.title}** is the clearest focal point.`;

    return [
      `${this.capitalize(topCategory)} topics are setting the pace today, with ${topSource} contributing the heaviest share of coverage.`,
      `The strongest story right now is **${leadTopic.title}**, which leads the board at a score of ${leadTopic.score}.`,
      repeatedTagText,
      `Across ${topics.length} tracked items, the mix leans toward fresh developments rather than long-tail backlog.`,
    ].join(' ');
  }

  private firstKey(counts: Map<string, number>): string | null {
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
  }

  private truncate(text: string, maxLength: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }
    return `${value[0].toUpperCase()}${value.slice(1)}`;
  }
}
