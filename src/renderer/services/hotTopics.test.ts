import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { hotTopicsService } from './hotTopics';

function createHotTopicsApi() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    getDigest: vi.fn(),
    startResearch: vi.fn(),
    startWriting: vi.fn(),
    pushToIM: vi.fn(),
    saveToKnowledge: vi.fn(),
    onEvent: vi.fn(() => vi.fn()),
  };
}

describe('hotTopicsService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('delegates successful calls to the preload API', async () => {
    const hotTopics = createHotTopicsApi();
    hotTopics.getStatus.mockResolvedValue({
      active: true,
      sources: [{ source: 'hacker-news', enabled: true, interval: 1800 }],
    });
    hotTopics.list.mockResolvedValue([
      {
        id: 'topic-1',
        title: 'New model release',
        summary: 'A new open model shipped.',
        source: 'hacker-news',
        url: 'https://example.com/topic-1',
        score: 0.91,
        category: 'ai',
        discoveredAt: '2026-06-07T00:00:00.000Z',
        tags: ['ai'],
      },
    ]);
    const unsubscribe = vi.fn();
    hotTopics.onEvent.mockReturnValue(unsubscribe);

    vi.stubGlobal('window', {
      electron: {
        hotTopics,
      },
    });

    await expect(hotTopicsService.getStatus()).resolves.toEqual({
      active: true,
      sources: [{ source: 'hacker-news', enabled: true, interval: 1800 }],
    });
    await expect(hotTopicsService.list(20)).resolves.toEqual([
      {
        id: 'topic-1',
        title: 'New model release',
        summary: 'A new open model shipped.',
        source: 'hacker-news',
        url: 'https://example.com/topic-1',
        score: 0.91,
        category: 'ai',
        discoveredAt: '2026-06-07T00:00:00.000Z',
        tags: ['ai'],
      },
    ]);

    const handler = vi.fn();
    expect(hotTopicsService.onEvent(handler)).toBe(unsubscribe);
    expect(hotTopics.list).toHaveBeenCalledWith(20);
    expect(hotTopics.onEvent).toHaveBeenCalledWith(handler);
  });

  test('returns safe fallbacks when the preload API throws', async () => {
    const hotTopics = createHotTopicsApi();
    hotTopics.start.mockRejectedValue(new Error('boom'));
    hotTopics.stop.mockRejectedValue(new Error('boom'));
    hotTopics.getDigest.mockRejectedValue(new Error('boom'));
    hotTopics.startResearch.mockRejectedValue(new Error('boom'));

    vi.stubGlobal('window', {
      electron: {
        hotTopics,
      },
    });

    await expect(hotTopicsService.start([])).resolves.toEqual({
      active: false,
      sources: [],
    });
    await expect(hotTopicsService.stop()).resolves.toBe(false);
    await expect(hotTopicsService.getDigest()).resolves.toBeNull();
    await expect(hotTopicsService.startResearch('topic-1')).resolves.toBeNull();
  });
});
