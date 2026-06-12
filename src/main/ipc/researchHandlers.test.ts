import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResearchQuery } from '../../features/deep-research';

const researchHandlersTestState = vi.hoisted(() => {
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
    handle: researchHandlersTestState.handle,
  },
  BrowserWindow: {
    getAllWindows: researchHandlersTestState.getAllWindows,
  },
}));

import { registerResearchHandlers } from './researchHandlers';

class FakeResearchSession extends EventEmitter {
  private readonly record = {
    id: 'research-1',
    query: {
      query: 'agora architecture rewrite',
      sources: ['web'],
      maxRounds: 1,
    },
    status: 'running' as const,
    result: null,
    report: null,
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
  };

  create = vi.fn((query: ResearchQuery) => {
    const session = {
      ...this.record,
      query,
    };
    this.emit('research:event', {
      type: 'session:created',
      sessionId: session.id,
      timestamp: '2026-06-07T00:00:00.000Z',
      record: session,
    });
    return session;
  });

  cancel = vi.fn(() => true);
  get = vi.fn(() => this.record);
  getResult = vi.fn(() => ({
    query: 'agora architecture rewrite',
    rounds: [],
    findings: [],
    synthesis: 'summary',
    sources: [],
    confidence: 0.8,
    savedToKnowledgeBase: true,
  }));
  list = vi.fn(() => [this.record]);
  getReport = vi.fn(() => '# report');
  pushToIM = vi.fn(async () => ({
    sessionId: 'research-1',
    success: true,
    result: 'Delivered research "agora architecture rewrite" to feishu:instance-1:group:chat-1',
    payload: {
      delivered: ['feishu:instance-1:group:chat-1'],
      failed: [],
    },
    timestamp: '2026-06-07T00:00:00.000Z',
  }));
}

describe('researchHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    researchHandlersTestState.handlers.clear();
  });

  it('starts sessions and forwards research events to renderer windows', async () => {
    const session = new FakeResearchSession();

    registerResearchHandlers({
      getResearchSession: () => session as never,
    });

    const start = researchHandlersTestState.handlers.get('research:start');
    expect(start).toBeTypeOf('function');

    await expect(
      start?.({}, {
        query: 'agora architecture rewrite',
        sources: ['web'],
        maxRounds: 1,
      }),
    ).resolves.toMatchObject({
      success: true,
      session: expect.objectContaining({
        id: 'research-1',
        status: 'running',
      }),
    });

    expect(session.create).toHaveBeenCalledWith({
      query: 'agora architecture rewrite',
      sources: ['web'],
      maxRounds: 1,
    });
    expect(researchHandlersTestState.send).toHaveBeenCalledWith(
      'research:event',
      expect.objectContaining({
        sessionId: 'research-1',
        type: 'session:created',
      }),
    );
  });

  it('exposes cancel/status/result/list/report/delivery handlers through the shared session runtime', async () => {
    const session = new FakeResearchSession();

    registerResearchHandlers({
      getResearchSession: () => session as never,
    });

    const cancel = researchHandlersTestState.handlers.get('research:cancel');
    const getStatus = researchHandlersTestState.handlers.get('research:getStatus');
    const getResult = researchHandlersTestState.handlers.get('research:getResult');
    const list = researchHandlersTestState.handlers.get('research:list');
    const getReport = researchHandlersTestState.handlers.get('research:getReport');
    const pushToIM = researchHandlersTestState.handlers.get('research:pushToIM');

    await expect(cancel?.({}, 'research-1')).resolves.toMatchObject({
      success: true,
      cancelled: true,
    });
    await expect(getStatus?.({}, 'research-1')).resolves.toMatchObject({
      success: true,
      session: expect.objectContaining({ id: 'research-1' }),
    });
    await expect(getResult?.({}, 'research-1')).resolves.toMatchObject({
      success: true,
      result: expect.objectContaining({
        query: 'agora architecture rewrite',
      }),
    });
    await expect(list?.()).resolves.toMatchObject({
      success: true,
      sessions: [expect.objectContaining({ id: 'research-1' })],
    });
    await expect(getReport?.({}, 'research-1')).resolves.toMatchObject({
      success: true,
      report: '# report',
    });
    await expect(
      pushToIM?.({}, 'research-1', ['feishu:instance-1:group:chat-1']),
    ).resolves.toMatchObject({
      success: true,
      result: expect.objectContaining({
        success: true,
        payload: expect.objectContaining({
          delivered: ['feishu:instance-1:group:chat-1'],
        }),
      }),
    });
  });
});
