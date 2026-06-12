import { describe, expect, it } from 'vitest';

import { TopicDigestGenerator } from './TopicDigest';
import type { TopicItem } from './types';

function createTopic(
  id: string,
  overrides: Partial<TopicItem> = {},
): TopicItem {
  return {
    id,
    title: `Topic ${id}`,
    summary: `Summary for ${id}`,
    source: 'hacker-news',
    url: `https://example.com/${id}`,
    score: 60,
    category: 'tech',
    discoveredAt: '2026-06-07T08:00:00.000Z',
    tags: ['agora', 'architecture'],
    ...overrides,
  };
}

describe('TopicDigestGenerator', () => {
  it('sorts topics by score when generating a digest', () => {
    const generator = new TopicDigestGenerator();
    const digest = generator.generateDigest([
      createTopic('low', { score: 40 }),
      createTopic('high', { score: 92 }),
      createTopic('mid', { score: 70 }),
    ]);

    expect(digest.topics.map((topic) => topic.id)).toEqual(['high', 'mid', 'low']);
  });

  it('produces a narrative summary without placeholder text', async () => {
    const generator = new TopicDigestGenerator();
    const summary = await generator.summarizeWithAI([
      createTopic('1', {
        title: 'Open Source AI Assistant',
        summary: 'A new open source assistant is gaining momentum across developer communities.',
        source: 'hacker-news',
        score: 95,
        category: 'ai',
        tags: ['open-source', 'assistant', 'agora'],
      }),
      createTopic('2', {
        title: 'Model Serving Stack Upgrade',
        summary: 'Teams are standardizing on faster serving layers for inference-heavy workloads.',
        source: 'reddit',
        score: 83,
        category: 'ai',
        tags: ['open-source', 'serving', 'infra'],
      }),
      createTopic('3', {
        title: 'Browser Tooling Release',
        summary: 'New browser debugging workflows land in a popular frontend toolkit.',
        source: 'reddit',
        score: 74,
        category: 'tech',
        tags: ['frontend', 'tooling', 'agora'],
      }),
    ]);

    expect(summary).toContain('## Daily Hot Topics Summary');
    expect(summary).toContain('**Leading categories:** ai (2 topics), tech (1 topics)');
    expect(summary).toContain('Open Source AI Assistant');
    expect(summary).toContain('### Signals to Watch');
    expect(summary).toContain('`open-source`');
    expect(summary).not.toContain('placeholder');
  });
});
