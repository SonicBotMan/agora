import { describe, expect, it, vi } from 'vitest';

import {
  DefaultActionDispatcher,
  type TopicActionIMGateway,
} from './TopicActions';
import type { TopicItem } from './types';

function createTopic(overrides: Partial<TopicItem> = {}): TopicItem {
  return {
    id: 'topic-1',
    title: 'Agora Architecture Rewrite',
    summary: 'Main process split and new runtime services.',
    source: 'hacker-news',
    url: 'https://example.com/topic-1',
    score: 87,
    category: 'tech',
    discoveredAt: '2026-06-07T00:00:00.000Z',
    tags: ['agora', 'runtime'],
    ...overrides,
  };
}

function createGateway(
  overrides: Partial<TopicActionIMGateway> = {},
): TopicActionIMGateway & {
  getNotificationTarget: ReturnType<typeof vi.fn>;
  sendConversationReply: ReturnType<typeof vi.fn>;
} {
  const getNotificationTarget = vi.fn().mockReturnValue(null);
  const sendConversationReply = vi.fn().mockResolvedValue(true);

  return {
    getNotificationTarget,
    getIMStore: () => ({
      getNotificationTarget,
    }),
    getActiveFeishuEngineKey: () => 'codex',
    isConnected: () => true,
    sendConversationReply,
    ...overrides,
  };
}

describe('TopicActions', () => {
  it('generates a structured writing draft with the rounded topic score', async () => {
    const dispatcher = new DefaultActionDispatcher();

    const result = await dispatcher.writing({
      topicId: 'topic-1',
      topic: createTopic(),
      style: 'analysis',
      tone: 'critical',
    });

    expect(result).toMatchObject({
      topicId: 'topic-1',
      action: 'writing',
      success: true,
      payload: {
        draftTitle: 'Agora Architecture Rewrite Analysis Draft',
        format: 'markdown',
        style: 'analysis',
      },
    });

    const payload = result.payload as Record<string, unknown>;
    expect(payload.draft).toEqual(expect.any(String));
    expect(payload.draft).toEqual(expect.stringContaining('87 points'));
    expect(payload.draft).toEqual(
      expect.stringContaining('Main process split and new runtime services.'),
    );
    expect(payload.estimatedWords).toEqual(expect.any(Number));
    expect(payload.estimatedWords).toBeGreaterThan(0);
  });

  it('fails push actions when no IM gateway is available', async () => {
    const dispatcher = new DefaultActionDispatcher();

    const result = await dispatcher.push({
      topicId: 'topic-1',
      topic: createTopic(),
      channels: ['feishu'],
      format: 'text',
    });

    expect(result).toMatchObject({
      topicId: 'topic-1',
      action: 'push',
      success: false,
      error: 'IM gateway manager is not available for hot topic delivery.',
    });
  });

  it('rejects non-Feishu outbound targets instead of reporting fake success', async () => {
    const gateway = createGateway();
    const dispatcher = new DefaultActionDispatcher({
      getIMGatewayManager: () => gateway,
    });

    const result = await dispatcher.push({
      topicId: 'topic-1',
      topic: createTopic(),
      channels: ['telegram'],
      format: 'text',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'only native Feishu outbound delivery is currently supported.',
    );
    expect(gateway.sendConversationReply).not.toHaveBeenCalled();
  });

  it('delivers to an explicit Feishu conversation target', async () => {
    const gateway = createGateway();
    const dispatcher = new DefaultActionDispatcher({
      getIMGatewayManager: () => gateway,
    });

    const result = await dispatcher.push({
      topicId: 'topic-1',
      topic: createTopic(),
      channels: ['feishu:instance-1:group:chat-1'],
      format: 'text',
    });

    expect(result).toMatchObject({
      topicId: 'topic-1',
      action: 'push',
      success: true,
      payload: {
        delivered: ['feishu:instance-1:group:chat-1'],
        failed: [],
      },
    });
    expect(gateway.sendConversationReply).toHaveBeenCalledWith(
      'feishu',
      'instance-1:group:chat-1',
      expect.stringContaining('Agora Architecture Rewrite'),
    );
  });

  it('falls back to the stored Feishu conversation target when only the platform is provided', async () => {
    const gateway = createGateway({
      getActiveFeishuEngineKey: undefined,
    });
    gateway.getNotificationTarget.mockReturnValue({
      conversationId: 'instance-2:group:chat-2',
    });

    const dispatcher = new DefaultActionDispatcher({
      getIMGatewayManager: () => gateway,
    });

    const result = await dispatcher.push({
      topicId: 'topic-1',
      topic: createTopic(),
      channels: ['feishu'],
      format: 'link',
    });

    expect(result).toMatchObject({
      success: true,
      payload: {
        delivered: ['feishu'],
      },
    });
    expect(gateway.sendConversationReply).toHaveBeenCalledWith(
      'feishu',
      'instance-2:group:chat-2',
      'Agora Architecture Rewrite\nhttps://example.com/topic-1',
    );
  });
});
