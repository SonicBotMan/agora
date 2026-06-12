import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../../shared/cowork/constants';

const orchestratorHandlersTestState = vi.hoisted(() => {
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
    handle: orchestratorHandlersTestState.handle,
  },
  BrowserWindow: {
    getAllWindows: orchestratorHandlersTestState.getAllWindows,
  },
}));

import { registerOrchestratorHandlers } from './orchestratorHandlers';

class FakeRuntime extends EventEmitter {
  startSession = vi.fn<
    (sessionId: string, prompt: string) => Promise<void>
  >();

  stopSession = vi.fn((sessionId: string) => {
    this.emit('sessionStopped', sessionId);
  });

  isSessionActive = vi.fn(() => true);
}

describe('orchestratorHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orchestratorHandlersTestState.handlers.clear();
  });

  it('plans and executes graphs through the shared runtime while forwarding orchestrator events', async () => {
    const runtime = new FakeRuntime();
    runtime.startSession.mockImplementation(async (sessionId, prompt) => {
      runtime.emit('message', sessionId, {
        id: 'assistant-1',
        type: 'assistant',
        content: `done:${prompt}`,
        timestamp: Date.now(),
      });
      runtime.emit('complete', sessionId, null);
    });

    registerOrchestratorHandlers({
      getCoworkEngineRouter: () => runtime as never,
    });

    const listTemplates = orchestratorHandlersTestState.handlers.get('orchestrator:listTemplates');
    const plan = orchestratorHandlersTestState.handlers.get('orchestrator:plan');
    const execute = orchestratorHandlersTestState.handlers.get('orchestrator:execute');

    expect(listTemplates).toBeTypeOf('function');
    await expect(listTemplates?.()).resolves.toMatchObject({
      success: true,
      templates: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String) }),
      ]),
    });

    const planResult = await plan?.({}, 'Ship the orchestrator backend');
    expect(planResult).toMatchObject({
      success: true,
      graph: expect.objectContaining({
        status: 'pending',
        source: 'auto',
        nodes: expect.arrayContaining([
          expect.objectContaining({
            agentEngine: CoworkAgentEngine.Hermes,
            id: 'requirements-analysis',
          }),
          expect.objectContaining({
            agentEngine: CoworkAgentEngine.ClaudeCode,
            id: 'backend-implementation',
          }),
        ]),
      }),
    });

    const executeResult = await execute?.({}, (planResult as { graph: { id: string } }).graph.id);
    expect(executeResult).toMatchObject({
      success: true,
      graph: expect.objectContaining({
        status: 'completed',
        nodes: expect.arrayContaining([
          expect.objectContaining({
            status: 'completed',
            result: expect.stringContaining('done:'),
          }),
        ]),
      }),
      summary: expect.stringContaining('Aggregated Results'),
    });
    expect(runtime.startSession).toHaveBeenCalledTimes(6);
    expect(orchestratorHandlersTestState.send).toHaveBeenCalledWith(
      'orchestrator:event',
      expect.objectContaining({
        graphId: (planResult as { graph: { id: string } }).graph.id,
      }),
    );
  });

  it('cancels pending graphs and returns the updated graph status', async () => {
    const runtime = new FakeRuntime();

    registerOrchestratorHandlers({
      getCoworkEngineRouter: () => runtime as never,
    });

    const plan = orchestratorHandlersTestState.handlers.get('orchestrator:plan');
    const cancel = orchestratorHandlersTestState.handlers.get('orchestrator:cancel');
    const getStatus = orchestratorHandlersTestState.handlers.get('orchestrator:getStatus');

    const planResult = await plan?.({}, 'Draft release plan');
    const graphId = (planResult as { graph: { id: string } }).graph.id;

    await expect(cancel?.({}, graphId)).resolves.toMatchObject({
      success: true,
      cancelled: true,
    });

    await expect(getStatus?.({}, graphId)).resolves.toMatchObject({
      success: true,
      graph: expect.objectContaining({
        status: 'failed',
        nodes: expect.arrayContaining([
          expect.objectContaining({
            status: 'cancelled',
            error: 'Cancelled by user',
          }),
        ]),
      }),
    });
  });
});
