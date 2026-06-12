import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hotTopicsHandlersTestState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const handle = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });
  const send = vi.fn();
  const getAllWindows = vi.fn(() => [
    {
      isDestroyed: () => false,
      webContents: {
        send,
      },
    },
  ]);

  return {
    handlers,
    handle,
    send,
    getAllWindows,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: hotTopicsHandlersTestState.handle,
  },
  BrowserWindow: {
    getAllWindows: hotTopicsHandlersTestState.getAllWindows,
  },
}));

import { registerHotTopicsHandlers } from './hotTopicsHandlers';

class FakeTopicMonitor extends EventEmitter {
  start = vi.fn((sources) => {
    this.emit('new-topic', {
      type: 'new-topic',
      topic: {
        id: 'topic-1',
        title: 'Agora rewrite',
      },
    });
    return sources;
  });

  stop = vi.fn();
  isActive = vi.fn(() => true);
  getSources = vi.fn(() => [
    { source: 'hacker-news', enabled: true, interval: 60 },
  ]);
  listTopics = vi.fn(() => [{ id: 'topic-1', title: 'Agora rewrite' }]);
  getTopic = vi.fn(() => ({ id: 'topic-1', title: 'Agora rewrite' }));
  getTodayDigest = vi.fn(async () => ({
    date: '2026-06-07',
    topics: [{ id: 'topic-1' }],
    aiSummary: 'summary',
  }));
  startResearch = vi.fn(async () => ({
    topicId: 'topic-1',
    action: 'research',
    success: true,
    timestamp: '2026-06-07T00:00:00.000Z',
  }));
  startWriting = vi.fn(async () => ({
    topicId: 'topic-1',
    action: 'writing',
    success: true,
    timestamp: '2026-06-07T00:00:00.000Z',
  }));
  pushToIM = vi.fn(async () => ({
    topicId: 'topic-1',
    action: 'push',
    success: true,
    timestamp: '2026-06-07T00:00:00.000Z',
  }));
  saveToKnowledge = vi.fn(async () => ({
    topicId: 'topic-1',
    action: 'save',
    success: true,
    timestamp: '2026-06-07T00:00:00.000Z',
  }));
}

describe('hotTopicsHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hotTopicsHandlersTestState.handlers.clear();
  });

  it('starts the topic monitor and forwards emitted events to renderer windows', async () => {
    const monitor = new FakeTopicMonitor();

    registerHotTopicsHandlers({
      getTopicMonitor: () => monitor as never,
    });

    const start = hotTopicsHandlersTestState.handlers.get('hotTopics:start');
    expect(start).toBeTypeOf('function');

    await expect(start?.({}, [
      { source: 'hacker-news', enabled: true, interval: 60 },
    ])).resolves.toMatchObject({
      success: true,
      active: true,
      sources: [{ source: 'hacker-news', enabled: true, interval: 60 }],
    });

    expect(monitor.start).toHaveBeenCalledWith([
      { source: 'hacker-news', enabled: true, interval: 60 },
    ]);
    expect(hotTopicsHandlersTestState.send).toHaveBeenCalledWith(
      'hotTopics:event',
      expect.objectContaining({
        type: 'new-topic',
      }),
    );
  });

  it('exposes list/status/digest/action handlers through the shared monitor runtime', async () => {
    const monitor = new FakeTopicMonitor();

    registerHotTopicsHandlers({
      getTopicMonitor: () => monitor as never,
    });

    const stop = hotTopicsHandlersTestState.handlers.get('hotTopics:stop');
    const getStatus = hotTopicsHandlersTestState.handlers.get('hotTopics:getStatus');
    const list = hotTopicsHandlersTestState.handlers.get('hotTopics:list');
    const get = hotTopicsHandlersTestState.handlers.get('hotTopics:get');
    const getDigest = hotTopicsHandlersTestState.handlers.get('hotTopics:getDigest');
    const startResearch = hotTopicsHandlersTestState.handlers.get('hotTopics:startResearch');
    const startWriting = hotTopicsHandlersTestState.handlers.get('hotTopics:startWriting');
    const pushToIM = hotTopicsHandlersTestState.handlers.get('hotTopics:pushToIM');
    const saveToKnowledge = hotTopicsHandlersTestState.handlers.get('hotTopics:saveToKnowledge');

    await expect(stop?.()).resolves.toMatchObject({
      success: true,
      active: true,
    });
    expect(monitor.stop).toHaveBeenCalledTimes(1);

    await expect(getStatus?.()).resolves.toMatchObject({
      success: true,
      active: true,
      sources: [expect.objectContaining({ source: 'hacker-news' })],
    });
    await expect(list?.({}, 5)).resolves.toMatchObject({
      success: true,
      topics: [{ id: 'topic-1', title: 'Agora rewrite' }],
    });
    await expect(get?.({}, 'topic-1')).resolves.toMatchObject({
      success: true,
      topic: { id: 'topic-1', title: 'Agora rewrite' },
    });
    await expect(getDigest?.()).resolves.toMatchObject({
      success: true,
      digest: expect.objectContaining({ aiSummary: 'summary' }),
    });
    await expect(startResearch?.({}, 'topic-1')).resolves.toMatchObject({
      success: true,
      result: expect.objectContaining({ action: 'research' }),
    });
    await expect(startWriting?.({}, 'topic-1', 'analysis')).resolves.toMatchObject({
      success: true,
      result: expect.objectContaining({ action: 'writing' }),
    });
    await expect(pushToIM?.({}, 'topic-1', ['feishu'])).resolves.toMatchObject({
      success: true,
      result: expect.objectContaining({ action: 'push' }),
    });
    await expect(saveToKnowledge?.({}, 'topic-1')).resolves.toMatchObject({
      success: true,
      result: expect.objectContaining({ action: 'save' }),
    });
  });
});
