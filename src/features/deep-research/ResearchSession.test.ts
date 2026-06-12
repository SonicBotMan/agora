import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResearchSession } from './ResearchSession';
import type { ResearchQuery, ResearchResult } from './types';

function createQuery(): ResearchQuery {
  return {
    query: 'agora architecture rewrite',
    sources: ['web', 'scholar'],
    maxRounds: 2,
    crossValidate: true,
  };
}

function createResult(): ResearchResult {
  const source = {
    url: 'https://example.com/research',
    title: 'Example Research',
    type: 'web' as const,
    retrievedAt: '2026-06-07T00:00:00.000Z',
  };

  return {
    query: 'agora architecture rewrite',
    rounds: [
      {
        round: 1,
        searchQueries: ['agora architecture rewrite'],
        findings: [
          {
            source,
            title: 'Architecture notes',
            snippet: 'Refactor main process into focused runtime services.',
            url: source.url,
            relevanceScore: 0.9,
          },
        ],
        newQuestions: [],
      },
    ],
    findings: [
      {
        source,
        title: 'Architecture notes',
        snippet: 'Refactor main process into focused runtime services.',
        url: source.url,
        relevanceScore: 0.9,
      },
    ],
    synthesis: 'Split main-process concerns into runtime services and IPC modules.',
    sources: [source],
    confidence: 0.92,
    savedToKnowledgeBase: false,
  };
}

async function flushMicrotasks(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

async function waitForRecordStatus(
  session: ResearchSession,
  id: string,
  status: 'running' | 'completed' | 'cancelled' | 'error',
): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (session.get(id)?.status === status) {
      return;
    }
    await flushMicrotasks(2);
  }

  throw new Error(`Timed out waiting for research session "${id}" to reach status "${status}"`);
}

describe('ResearchSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('completes sessions, persists the result metadata, and emits lifecycle events', async () => {
    const baseResult = createResult();
    const engine = {
      research: vi.fn(async function* () {
        yield {
          type: 'round-complete' as const,
          round: 1,
          findings: baseResult.findings,
          newQuestions: [],
        };
        yield {
          type: 'saved' as const,
          result: baseResult,
        };
      }),
    };
    const researchIngestor = {
      ingest: vi.fn().mockResolvedValue({
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [],
      }),
      hasKnowledgeStore: vi.fn(() => true),
    };
    const reportGenerator = {
      generate: vi.fn().mockReturnValue('# report'),
    };
    const session = new ResearchSession({
      engine: engine as never,
      researchIngestor: researchIngestor as never,
      reportGenerator: reportGenerator as never,
    });
    const events: string[] = [];

    session.on('research:event', (event) => {
      events.push(event.type);
    });

    const record = session.create(createQuery());

    await waitForRecordStatus(session, record.id, 'completed');

    const completed = session.get(record.id);
    expect(completed).toMatchObject({
      id: record.id,
      status: 'completed',
      report: '# report',
    });
    expect(session.getResult(record.id)).toMatchObject({
      query: baseResult.query,
      savedToKnowledgeBase: true,
    });
    expect(session.getReport(record.id)).toBe('# report');
    expect(researchIngestor.ingest).toHaveBeenCalledWith(baseResult);
    expect(reportGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        savedToKnowledgeBase: true,
      }),
    );
    expect(events).toEqual([
      'session:created',
      'session:updated',
      'session:updated',
      'session:completed',
    ]);
  });

  it('marks running sessions cancelled and skips ingestion after abort', async () => {
    const baseResult = createResult();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine = {
      research: vi.fn(async function* () {
        await gate;
        yield {
          type: 'saved' as const,
          result: baseResult,
        };
      }),
    };
    const researchIngestor = {
      ingest: vi.fn(),
      hasKnowledgeStore: vi.fn(() => true),
    };
    const session = new ResearchSession({
      engine: engine as never,
      researchIngestor: researchIngestor as never,
    });
    const eventTypes: string[] = [];

    session.on('research:event', (event) => {
      eventTypes.push(event.type);
    });

    const record = session.create(createQuery());
    await flushMicrotasks(2);

    expect(session.cancel(record.id)).toBe(true);
    release();
    await flushMicrotasks();

    expect(session.get(record.id)).toMatchObject({
      id: record.id,
      status: 'cancelled',
      result: null,
      report: null,
    });
    expect(researchIngestor.ingest).not.toHaveBeenCalled();
    expect(eventTypes).toContain('session:cancelled');
  });

  it('delivers completed research summaries to an explicit Feishu conversation target', async () => {
    const baseResult = createResult();
    const engine = {
      research: vi.fn(async function* () {
        yield {
          type: 'saved' as const,
          result: baseResult,
        };
      }),
    };
    const sendConversationReply = vi.fn().mockResolvedValue(true);
    const session = new ResearchSession({
      engine: engine as never,
      researchIngestor: {
        ingest: vi.fn().mockResolvedValue({
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [],
        }),
        hasKnowledgeStore: vi.fn(() => true),
      } as never,
      getIMGatewayManager: () => ({
        getIMStore: () => ({
          getNotificationTarget: vi.fn(),
        }),
        getActiveFeishuEngineKey: () => 'codex',
        isConnected: () => true,
        sendConversationReply,
      }),
    });

    const record = session.create(createQuery());
    await waitForRecordStatus(session, record.id, 'completed');

    const delivery = await session.pushToIM(record.id, [
      'feishu:instance-1:group:chat-1',
    ]);

    expect(delivery).toMatchObject({
      sessionId: record.id,
      success: true,
      payload: {
        delivered: ['feishu:instance-1:group:chat-1'],
        failed: [],
      },
    });
    expect(sendConversationReply).toHaveBeenCalledWith(
      'feishu',
      'instance-1:group:chat-1',
      expect.stringContaining('Deep Research: agora architecture rewrite'),
    );
  });

  it('returns a clear failure when research delivery has no IM gateway available', async () => {
    const baseResult = createResult();
    const engine = {
      research: vi.fn(async function* () {
        yield {
          type: 'saved' as const,
          result: baseResult,
        };
      }),
    };
    const session = new ResearchSession({
      engine: engine as never,
      researchIngestor: {
        ingest: vi.fn().mockResolvedValue({
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [],
        }),
        hasKnowledgeStore: vi.fn(() => true),
      } as never,
    });

    const record = session.create(createQuery());
    await waitForRecordStatus(session, record.id, 'completed');

    await expect(session.pushToIM(record.id, ['feishu'])).resolves.toMatchObject({
      sessionId: record.id,
      success: false,
      error: 'IM gateway manager is not available for research delivery.',
    });
  });
});
