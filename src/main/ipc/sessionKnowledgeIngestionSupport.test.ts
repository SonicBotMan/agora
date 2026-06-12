import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';

import {
  bindSessionKnowledgeIngestion,
  toConversationMessages,
} from './sessionKnowledgeIngestionSupport';

class RuntimeEmitter extends EventEmitter {}

function flushTasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('sessionKnowledgeIngestionSupport', () => {
  it('maps stored cowork messages into knowledge-base conversation messages', () => {
    expect(toConversationMessages([
      {
        id: 'user-1',
        type: 'user',
        content: 'Draft the rollout plan',
        timestamp: Date.UTC(2026, 5, 7, 0, 0, 0),
      },
      {
        id: 'tool-1',
        type: 'tool_use',
        content: 'Using tool: edit_file',
        timestamp: Date.UTC(2026, 5, 7, 0, 0, 1),
      },
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'Here is the rollout plan.',
        timestamp: Date.UTC(2026, 5, 7, 0, 0, 2),
      },
    ] as never)).toEqual([
      {
        role: 'user',
        content: 'Draft the rollout plan',
        timestamp: '2026-06-07T00:00:00.000Z',
      },
      {
        role: 'assistant',
        content: 'Here is the rollout plan.',
        timestamp: '2026-06-07T00:00:02.000Z',
      },
    ]);
  });

  it('ingests the completed session conversation into the knowledge base', async () => {
    const runtime = new RuntimeEmitter();
    const ingest = vi.fn().mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      results: [],
    });
    const getSession = vi.fn().mockReturnValue({
      id: 'session-1',
      messages: [
        {
          id: 'user-1',
          type: 'user',
          content: 'Please summarize today',
          timestamp: Date.UTC(2026, 5, 7, 1, 0, 0),
        },
        {
          id: 'assistant-1',
          type: 'assistant',
          content: 'Summary is ready.',
          timestamp: Date.UTC(2026, 5, 7, 1, 0, 5),
        },
      ],
    });

    bindSessionKnowledgeIngestion({
      getCoworkEngineRouter: () => runtime as never,
      getCoworkStore: () => ({ getSession }) as never,
      getConversationIngestor: () => ({ ingest }) as never,
    });

    runtime.emit('complete', 'session-1');
    await flushTasks();

    expect(getSession).toHaveBeenCalledWith('session-1');
    expect(ingest).toHaveBeenCalledWith('session-1', [
      {
        role: 'user',
        content: 'Please summarize today',
        timestamp: '2026-06-07T01:00:00.000Z',
      },
      {
        role: 'assistant',
        content: 'Summary is ready.',
        timestamp: '2026-06-07T01:00:05.000Z',
      },
    ]);
  });

  it('skips ingestion when the completed session is missing or has no conversational messages', async () => {
    const runtime = new RuntimeEmitter();
    const ingest = vi.fn();
    const getSession = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        id: 'session-2',
        messages: [
          {
            id: 'tool-1',
            type: 'tool_use',
            content: 'Using tool: search',
            timestamp: Date.UTC(2026, 5, 7, 2, 0, 0),
          },
        ],
      });

    bindSessionKnowledgeIngestion({
      getCoworkEngineRouter: () => runtime as never,
      getCoworkStore: () => ({ getSession }) as never,
      getConversationIngestor: () => ({ ingest }) as never,
    });

    runtime.emit('complete', 'missing-session');
    runtime.emit('complete', 'session-2');
    await flushTasks();
    await flushTasks();

    expect(ingest).not.toHaveBeenCalled();
  });
});
