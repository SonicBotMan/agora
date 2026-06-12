import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { orchestratorService } from './orchestrator';

function createOrchestratorApi() {
  return {
    listTemplates: vi.fn(),
    plan: vi.fn(),
    execute: vi.fn(),
    cancel: vi.fn(),
    getStatus: vi.fn(),
    onEvent: vi.fn(() => vi.fn()),
  };
}

describe('orchestratorService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('delegates successful calls to the preload API', async () => {
    const orchestrator = createOrchestratorApi();
    orchestrator.listTemplates.mockResolvedValue([
      {
        id: 'project-dev',
        name: 'Project Development',
        description: 'Plan and execute a development project',
      },
    ]);
    orchestrator.execute.mockResolvedValue({
      graph: {
        id: 'graph-1',
        name: 'Auto Plan',
        description: 'Build the feature',
        nodes: [],
        source: 'auto',
        createdAt: '2026-06-07T00:00:00.000Z',
        status: 'completed',
      },
      summary: 'done',
    });
    const unsubscribe = vi.fn();
    orchestrator.onEvent.mockReturnValue(unsubscribe);

    vi.stubGlobal('window', {
      electron: {
        orchestrator,
      },
    });

    await expect(orchestratorService.listTemplates()).resolves.toEqual([
      {
        id: 'project-dev',
        name: 'Project Development',
        description: 'Plan and execute a development project',
      },
    ]);
    await expect(orchestratorService.execute('graph-1')).resolves.toEqual({
      graph: {
        id: 'graph-1',
        name: 'Auto Plan',
        description: 'Build the feature',
        nodes: [],
        source: 'auto',
        createdAt: '2026-06-07T00:00:00.000Z',
        status: 'completed',
      },
      summary: 'done',
    });

    const handler = vi.fn();
    expect(orchestratorService.onEvent(handler)).toBe(unsubscribe);
    expect(orchestrator.execute).toHaveBeenCalledWith('graph-1');
    expect(orchestrator.onEvent).toHaveBeenCalledWith(handler);
  });

  test('returns safe fallbacks when the preload API throws', async () => {
    const orchestrator = createOrchestratorApi();
    orchestrator.plan.mockRejectedValue(new Error('boom'));
    orchestrator.cancel.mockRejectedValue(new Error('boom'));
    orchestrator.getStatus.mockRejectedValue(new Error('boom'));

    vi.stubGlobal('window', {
      electron: {
        orchestrator,
      },
    });

    await expect(orchestratorService.plan('Build the feature')).resolves.toBeNull();
    await expect(orchestratorService.cancel('graph-1')).resolves.toBe(false);
    await expect(orchestratorService.getStatus('graph-1')).resolves.toBeNull();
  });
});
