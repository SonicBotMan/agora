/**
 * Daily digest generation and AI summary scaffolding.
 */

import type { TopicItem, TopicDigest } from './types';

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
   * Generate an AI summary skeleton for the digest.
   *
   * In production this would call an LLM. The current implementation
   * constructs a simple template placeholder.
   */
  async summarizeWithAI(topics: TopicItem[]): Promise<string> {
    if (topics.length === 0) {
      return 'No hot topics discovered today.';
    }

    const categories = new Map<string, number>();
    const topN = topics.slice(0, 5);

    for (const t of topics) {
      categories.set(t.category, (categories.get(t.category) ?? 0) + 1);
    }

    const categorySummary = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `${cat} (${count} topics)`)
      .join(', ');

    const topTitles = topN.map(t => `- **${t.title}** — ${t.summary.slice(0, 80)}`).join('\n');

    return [
      `## Daily Hot Topics Summary`,
      ``,
      `**Date:** ${new Date().toISOString().slice(0, 10)}`,
      `**Total topics:** ${topics.length}`,
      `**Categories:** ${categorySummary}`,
      ``,
      `### Top Stories`,
      ``,
      topTitles,
      ``,
      `> _AI summary placeholder — replace with LLM-generated synthesis._`,
    ].join('\n');
  }
}
