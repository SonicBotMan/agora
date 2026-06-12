import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ResearchQuery } from '../../features/deep-research';
import { researchService } from './research';

function createResearchApi() {
  return {
    start: vi.fn(),
    cancel: vi.fn(),
    getStatus: vi.fn(),
    getResult: vi.fn(),
    list: vi.fn(),
    getReport: vi.fn(),
    pushToIM: vi.fn(),
    onEvent: vi.fn(() => vi.fn()),
  };
}

describe('researchService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('delegates successful calls to the preload API', async () => {
    const research = createResearchApi();
    const query: ResearchQuery = {
      query: 'Agora architecture rewrite',
      sources: ['web'],
      maxRounds: 2,
    };
    const session = {
      id: 'research-1',
      query,
      status: 'running',
      result: null,
      report: null,
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
    };
    research.start.mockResolvedValue(session);
    research.list.mockResolvedValue([session]);
    research.pushToIM.mockResolvedValue({
      sessionId: 'research-1',
      success: true,
      result: 'Delivered research "Agora architecture rewrite" to feishu',
      timestamp: '2026-06-07T00:00:00.000Z',
    });
    const unsubscribe = vi.fn();
    research.onEvent.mockReturnValue(unsubscribe);

    vi.stubGlobal('window', {
      electron: {
        research,
      },
    });

    await expect(researchService.start(session.query)).resolves.toEqual(session);
    await expect(researchService.list()).resolves.toEqual([session]);
    await expect(researchService.pushToIM('research-1', ['feishu'])).resolves.toMatchObject({
      sessionId: 'research-1',
      success: true,
    });

    const handler = vi.fn();
    expect(researchService.onEvent(handler)).toBe(unsubscribe);
    expect(research.start).toHaveBeenCalledWith(session.query);
    expect(research.pushToIM).toHaveBeenCalledWith('research-1', ['feishu']);
    expect(research.onEvent).toHaveBeenCalledWith(handler);
  });

  test('returns safe fallbacks when the preload API throws', async () => {
    const research = createResearchApi();
    research.cancel.mockRejectedValue(new Error('boom'));
    research.getStatus.mockRejectedValue(new Error('boom'));
    research.getResult.mockRejectedValue(new Error('boom'));
    research.getReport.mockRejectedValue(new Error('boom'));
    research.pushToIM.mockRejectedValue(new Error('boom'));

    vi.stubGlobal('window', {
      electron: {
        research,
      },
    });

    await expect(researchService.cancel('research-1')).resolves.toBe(false);
    await expect(researchService.getStatus('research-1')).resolves.toBeNull();
    await expect(researchService.getResult('research-1')).resolves.toBeNull();
    await expect(researchService.getReport('research-1')).resolves.toBeNull();
    await expect(researchService.pushToIM('research-1', ['feishu'])).resolves.toBeNull();
  });
});
