/**
 * Topic classification, scoring, and deduplication.
 */

import type {
  ClassificationResult,
  ClassifiedTopics,
  ScoreWeights,
  TopicCategory,
  TopicItem,
} from './types';
import { DEFAULT_SCORE_WEIGHTS } from './types';

export class TopicClassifier {
  private weights: ScoreWeights;

  constructor(weights: Partial<ScoreWeights> = {}) {
    this.weights = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Group topics by category.
   */
  classify(topics: TopicItem[]): ClassificationResult {
    const groups = new Map<TopicCategory, TopicItem[]>();

    for (const topic of topics) {
      const category = topic.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(topic);
    }

    const classified: ClassifiedTopics[] = [];
    for (const [category, items] of groups) {
      classified.push({ category, topics: items });
    }

    return {
      groups: classified,
      unclassified: topics.filter(t => t.category === 'other'),
    };
  }

  /**
   * Compute a hotness score (0-100) for a single topic.
   */
  score(topic: TopicItem): number {
    const recencyScore = this.calcRecencyScore(topic.discoveredAt);
    const authorityScore = this.calcSourceAuthority(topic.source);
    const engagementScore = topic.score; // already a signal from the source
    const relevanceScore = this.calcRelevance(topic);

    const finalScore =
      recencyScore * this.weights.recency +
      authorityScore * this.weights.sourceAuthority +
      engagementScore * this.weights.engagement +
      relevanceScore * this.weights.relevance;

    return Math.min(100, Math.round(finalScore));
  }

  /**
   * Remove duplicate topics based on title similarity.
   */
  deduplicate(topics: TopicItem[]): TopicItem[] {
    const seen = new Set<string>();
    const result: TopicItem[] = [];

    for (const topic of topics) {
      const key = this.normalizeKey(topic.title);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(topic);
      }
    }

    return result;
  }

  // ── Internal Scoring ──────────────────────────────────────────────────────

  /**
   * Score based on how recent the topic is (0-100, newer = higher).
   */
  private calcRecencyScore(discoveredAt: string): number {
    const now = Date.now();
    const discovered = new Date(discoveredAt).getTime();
    const hoursAgo = (now - discovered) / 3_600_000;

    // Decay: full score in first hour, halves every 6 hours
    if (hoursAgo <= 1) return 100;
    return Math.max(0, Math.round(100 * Math.pow(0.5, (hoursAgo - 1) / 6)));
  }

  /**
   * Score based on source authority (0-100).
   */
  private calcSourceAuthority(source: string): number {
    const authorityMap: Record<string, number> = {
      arxiv: 90,
      'hacker-news': 75,
      twitter: 40,
      reddit: 50,
      weibo: 35,
    };
    return authorityMap[source] ?? 50;
  }

  /**
   * Score based on relevance signals from tags and title keywords.
   */
  private calcRelevance(topic: TopicItem): number {
    let score = 50; // baseline

    const keywords = ['ai', 'llm', 'gpt', 'security', 'blockchain',
      'quantum', 'open source', 'startup', 'funding', 'breakthrough'];

    const text = `${topic.title} ${topic.summary} ${topic.tags.join(' ')}`.toLowerCase();

    for (const kw of keywords) {
      if (text.includes(kw)) {
        score += 5;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Normalize a title string for dedup comparison.
   */
  private normalizeKey(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
      .slice(0, 60);
  }
}
