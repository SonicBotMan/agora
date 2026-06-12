import { beforeEach, describe, expect, it, vi } from 'vitest';

const topicMonitorTestState = vi.hoisted(() => {
  const create = vi.fn();
  const fetch = vi.fn();

  return {
    create,
    fetch,
  };
});

vi.mock('./crawlers/index', () => ({
  CrawlerFactory: {
    create: topicMonitorTestState.create,
  },
}));

import { TopicMonitor } from './TopicMonitor';
import type { TopicItem } from './types';

function createTopic(overrides: Partial<TopicItem> = {}): TopicItem {
  return {
    id: 'topic-1',
    title: 'Agora Architecture Rewrite',
    summary: 'Main process split and new runtime services.',
    source: 'hacker-news',
    url: 'https://example.com/topic-1',
    score: 80,
    category: 'tech',
    discoveredAt: new Date().toISOString(),
    tags: ['agora', 'architecture'],
    ...overrides,
  };
}

async function flushMicrotasks(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

function createActionDispatcher(overrides: Record<string, unknown> = {}) {
  return {
    research: vi.fn(async () => ({
      topicId: 'topic-1',
      action: 'research',
      success: true,
      timestamp: '2026-06-07T00:00:00.000Z',
    })),
    writing: vi.fn(async () => ({
      topicId: 'topic-1',
      action: 'writing',
      success: true,
      timestamp: '2026-06-07T00:00:00.000Z',
    })),
    push: vi.fn(async () => ({
      topicId: 'topic-1',
      action: 'push',
      success: true,
      timestamp: '2026-06-07T00:00:00.000Z',
    })),
    save: vi.fn(async () => ({
      topicId: 'topic-1',
      action: 'save',
      success: true,
      timestamp: '2026-06-07T00:00:00.000Z',
    })),
    ...overrides,
  };
}

describe('TopicMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discovers topics, emits digest events, and can save a topic to the knowledge store', async () => {
    const discoveredTopic = createTopic();
    topicMonitorTestState.create.mockReturnValue({
      fetch: topicMonitorTestState.fetch,
    });
    topicMonitorTestState.fetch.mockResolvedValue({
      source: 'hacker-news',
      topics: [discoveredTopic],
      fetchedAt: new Date().toISOString(),
    });

    const savedDocuments: Array<{ id: string; sourceId?: string }> = [];
    const knowledgeStore = {
      save: vi.fn(async (document) => {
        savedDocuments.push({
          id: (document as { id: string }).id,
          sourceId: (document as { sourceId?: string }).sourceId,
        });
      }),
    };
    const embedDocuments = vi.fn(async (documents) => documents);
    const monitor = new TopicMonitor({
      knowledgeStore: knowledgeStore as never,
      embeddingEngine: {
        embedDocuments,
      } as never,
    });
    const newTopicEvents: TopicItem[] = [];
    const digests: Array<{ topics: TopicItem[]; aiSummary?: string }> = [];

    monitor.on('new-topic', (event) => {
      newTopicEvents.push(event.topic);
    });
    monitor.on('digest-ready', (event) => {
      digests.push(event.digest);
    });

    monitor.start([
      {
        source: 'hacker-news',
        enabled: true,
        interval: 60,
      },
    ]);

    await flushMicrotasks(6);

    expect(topicMonitorTestState.create).toHaveBeenCalledWith('hacker-news');
    expect(newTopicEvents).toHaveLength(1);
    expect(newTopicEvents[0].id).toBe('topic-1');
    expect(monitor.isActive()).toBe(true);
    expect(monitor.listTopics()).toEqual([
      expect.objectContaining({
        id: 'topic-1',
      }),
    ]);
    expect(digests).toHaveLength(1);
    expect(digests[0].topics[0].id).toBe('topic-1');
    expect(typeof digests[0].aiSummary).toBe('string');

    const digest = await monitor.getTodayDigest();
    expect(digest.topics).toHaveLength(1);
    expect(digest.topics[0].id).toBe('topic-1');

    const saveResult = await monitor.saveToKnowledge('topic-1');
    expect(saveResult).toMatchObject({
      success: true,
      action: 'save',
      topicId: 'topic-1',
    });
    expect(embedDocuments).toHaveBeenCalledTimes(1);
    expect(knowledgeStore.save).toHaveBeenCalled();
    expect(savedDocuments[0]).toMatchObject({
      id: expect.stringContaining('hot-topic-topic-1'),
      sourceId: 'topic-1',
    });

    monitor.stop();
    expect(monitor.isActive()).toBe(false);
  });

  it('starts research for discovered topics and falls back cleanly for missing topics', async () => {
    const discoveredTopic = createTopic({
      id: 'topic-research',
      source: 'arxiv',
      title: 'Large Language Models for Refactoring',
    });
    topicMonitorTestState.create.mockReturnValue({
      fetch: topicMonitorTestState.fetch,
    });
    topicMonitorTestState.fetch.mockResolvedValue({
      source: 'arxiv',
      topics: [discoveredTopic],
      fetchedAt: new Date().toISOString(),
    });

    const researchSession = {
      create: vi.fn(() => ({ id: 'research-session-1' })),
    };
    const monitor = new TopicMonitor({
      researchSession: researchSession as never,
    });

    monitor.start([
      {
        source: 'arxiv',
        enabled: true,
        interval: 60,
      },
    ]);

    await flushMicrotasks(6);

    const researchResult = await monitor.startResearch('topic-research');
    expect(researchResult).toMatchObject({
      success: true,
      action: 'research',
      topicId: 'topic-research',
      payload: {
        sessionId: 'research-session-1',
      },
    });
    expect(researchSession.create).toHaveBeenCalledWith({
      query: expect.stringContaining('Large Language Models for Refactoring'),
      sources: ['scholar', 'web'],
      maxRounds: 3,
      crossValidate: true,
    });

    await expect(monitor.startResearch('missing-topic')).resolves.toMatchObject({
      success: false,
      action: 'research',
      error: 'Topic not found: missing-topic',
    });

    monitor.stop();
  });

  it('preserves writing draft payloads and appends the discovered topic metadata', async () => {
    const discoveredTopic = createTopic({
      id: 'topic-writing',
      title: 'Delivery Quality for Hot Topics',
    });
    topicMonitorTestState.create.mockReturnValue({
      fetch: topicMonitorTestState.fetch,
    });
    topicMonitorTestState.fetch.mockResolvedValue({
      source: 'hacker-news',
      topics: [discoveredTopic],
      fetchedAt: new Date().toISOString(),
    });

    const actionDispatcher = createActionDispatcher({
      writing: vi.fn(async () => ({
        topicId: 'topic-writing',
        action: 'writing',
        success: true,
        result: 'Generated draft',
        payload: {
          draft: '# Delivery Quality for Hot Topics',
          draftTitle: 'Delivery Quality for Hot Topics Analysis Draft',
          format: 'markdown',
          estimatedWords: 42,
        },
        timestamp: '2026-06-07T00:00:00.000Z',
      })),
    });
    const monitor = new TopicMonitor({
      actionDispatcher: actionDispatcher as never,
    });

    monitor.start([
      {
        source: 'hacker-news',
        enabled: true,
        interval: 60,
      },
    ]);

    await flushMicrotasks(6);

    const result = await monitor.startWriting('topic-writing', 'analysis');

    expect(actionDispatcher.writing).toHaveBeenCalledWith({
      topicId: 'topic-writing',
      topic: expect.objectContaining({
        id: 'topic-writing',
        title: 'Delivery Quality for Hot Topics',
      }),
      style: 'analysis',
    });
    expect(result).toMatchObject({
      topicId: 'topic-writing',
      action: 'writing',
      success: true,
      payload: {
        draft: '# Delivery Quality for Hot Topics',
        draftTitle: 'Delivery Quality for Hot Topics Analysis Draft',
        format: 'markdown',
        estimatedWords: 42,
        topic: expect.objectContaining({
          id: 'topic-writing',
        }),
      },
    });

    monitor.stop();
  });

  it('preserves push delivery payloads and the requested channels', async () => {
    const discoveredTopic = createTopic({
      id: 'topic-push',
      title: 'Feishu Delivery Path',
    });
    topicMonitorTestState.create.mockReturnValue({
      fetch: topicMonitorTestState.fetch,
    });
    topicMonitorTestState.fetch.mockResolvedValue({
      source: 'reddit',
      topics: [discoveredTopic],
      fetchedAt: new Date().toISOString(),
    });

    const actionDispatcher = createActionDispatcher({
      push: vi.fn(async () => ({
        topicId: 'topic-push',
        action: 'push',
        success: true,
        result: 'Delivered topic "Feishu Delivery Path" to feishu:instance-1:group:chat-1',
        payload: {
          delivered: ['feishu:instance-1:group:chat-1'],
          failed: [],
          message: 'Feishu Delivery Path',
        },
        timestamp: '2026-06-07T00:00:00.000Z',
      })),
    });
    const monitor = new TopicMonitor({
      actionDispatcher: actionDispatcher as never,
    });

    monitor.start([
      {
        source: 'reddit',
        enabled: true,
        interval: 60,
      },
    ]);

    await flushMicrotasks(6);

    const result = await monitor.pushToIM('topic-push', [
      'feishu:instance-1:group:chat-1',
    ]);

    expect(actionDispatcher.push).toHaveBeenCalledWith({
      topicId: 'topic-push',
      topic: expect.objectContaining({
        id: 'topic-push',
        title: 'Feishu Delivery Path',
      }),
      channels: ['feishu:instance-1:group:chat-1'],
      format: 'text',
    });
    expect(result).toMatchObject({
      topicId: 'topic-push',
      action: 'push',
      success: true,
      payload: {
        delivered: ['feishu:instance-1:group:chat-1'],
        failed: [],
        channels: ['feishu:instance-1:group:chat-1'],
        topic: expect.objectContaining({
          id: 'topic-push',
        }),
      },
    });

    monitor.stop();
  });

  it('emits an error event when a crawler reports a fetch error', async () => {
    topicMonitorTestState.create.mockReturnValue({
      fetch: topicMonitorTestState.fetch,
    });
    topicMonitorTestState.fetch.mockResolvedValue({
      source: 'custom',
      topics: [],
      fetchedAt: new Date().toISOString(),
      error: 'Remote source rate limited',
    });

    const monitor = new TopicMonitor();
    const errors: string[] = [];

    monitor.on('error', (event) => {
      errors.push(event.error.message);
    });

    monitor.start([
      {
        source: 'custom',
        enabled: true,
        interval: 60,
      },
    ]);

    await flushMicrotasks(6);

    expect(errors).toEqual(['Remote source rate limited']);

    monitor.stop();
  });
});
