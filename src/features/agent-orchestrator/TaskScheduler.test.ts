import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../../shared/cowork/constants';
import { AgentPool } from './AgentPool';
import { TaskScheduler } from './TaskScheduler';
import type { TaskGraph } from './types';

class FakeRuntime extends EventEmitter {
  startSession = vi.fn<
    (sessionId: string, prompt: string, options?: { agentEngine?: string; agentId?: string }) => Promise<void>
  >();

  stopSession = vi.fn((sessionId: string) => {
    this.emit('sessionStopped', sessionId);
  });

  isSessionActive = vi.fn((sessionId: string) => Boolean(sessionId));
}

function createGraph(): TaskGraph {
  return {
    id: 'graph-1',
    name: 'Graph 1',
    description: 'Test graph',
    source: 'manual',
    createdAt: new Date().toISOString(),
    status: 'pending',
    nodes: [
      {
        id: 'task-1',
        agentEngine: CoworkAgentEngine.Codex,
        agentId: 'agent-1',
        prompt: 'Implement feature X',
        dependsOn: [],
        status: 'pending',
      },
    ],
  };
}

describe('TaskScheduler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs tasks through the shared cowork runtime and resolves with assistant output', async () => {
    const runtime = new FakeRuntime();
    runtime.startSession.mockImplementation(async (sessionId, prompt) => {
      runtime.emit('message', sessionId, {
        id: 'assistant-1',
        type: 'assistant',
        content: `draft:${prompt}`,
        timestamp: Date.now(),
      });
      runtime.emit('messageUpdate', sessionId, 'assistant-1', `final:${prompt}`);
      runtime.emit('complete', sessionId, null);
    });

    const scheduler = new TaskScheduler(runtime as never, new AgentPool());
    const graph = await scheduler.execute(createGraph());

    expect(runtime.startSession).toHaveBeenCalledWith(
      expect.stringMatching(/^orchestrator-task-1-/),
      'Implement feature X',
      {
        agentEngine: CoworkAgentEngine.Codex,
        agentId: 'agent-1',
      },
    );
    expect(graph.status).toBe('completed');
    expect(graph.nodes[0].status).toBe('completed');
    expect(graph.nodes[0].result).toBe('final:Implement feature X');
  });

  it('marks running nodes cancelled when the scheduler is aborted', async () => {
    const runtime = new FakeRuntime();
    runtime.startSession.mockImplementation(async () => {
      // Keep the task running until the scheduler aborts it.
    });

    const scheduler = new TaskScheduler(runtime as never, new AgentPool());
    const executePromise = scheduler.execute(createGraph());

    await Promise.resolve();
    scheduler.cancel();

    const graph = await executePromise;

    expect(runtime.stopSession).toHaveBeenCalledTimes(1);
    expect(graph.status).toBe('failed');
    expect(graph.nodes[0].status).toBe('cancelled');
    expect(graph.nodes[0].error).toContain('cancelled');
  });
});
