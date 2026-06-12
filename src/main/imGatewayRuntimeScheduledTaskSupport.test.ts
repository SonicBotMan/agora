import { describe, expect, it, vi } from 'vitest';

import { createIMGatewayScheduledTaskHandler } from './imGatewayRuntimeScheduledTaskSupport';

function createDeps() {
  const addJob = vi.fn();
  const deps = {
    getCronJobService: vi.fn().mockReturnValue({
      addJob,
    }),
  };

  return {
    deps,
    addJob,
  };
}

describe('imGatewayRuntimeScheduledTaskSupport', () => {
  it('builds isolated channel tasks for IM conversations and strips channel prefixes from recipients', async () => {
    const { deps, addJob } = createDeps();
    addJob.mockResolvedValue({
      id: 'task-1',
      name: 'Daily follow-up',
      agentId: 'main',
      sessionKey: undefined,
      payload: {
        kind: 'agentTurn',
        message: 'follow up tomorrow',
      },
      schedule: {
        kind: 'at',
        at: '2026-06-08T10:00:00.000Z',
      },
    });
    const handler = createIMGatewayScheduledTaskHandler(deps as never);

    await expect(
      handler({
        sessionId: 'session-1',
        message: {
          platform: 'wecom',
          conversationId: 'wecom-openclaw-plugin:room-99',
        },
        request: {
          taskName: 'Daily follow-up',
          scheduleAt: '2026-06-08T10:00:00.000Z',
          payloadText: 'follow up tomorrow',
        },
      } as never),
    ).resolves.toEqual({
      id: 'task-1',
      name: 'Daily follow-up',
      agentId: 'main',
      sessionKey: undefined,
      payloadText: 'follow up tomorrow',
      scheduleAt: '2026-06-08T10:00:00.000Z',
    });

    expect(addJob).toHaveBeenCalledWith({
      name: 'Daily follow-up',
      description: '',
      enabled: true,
      schedule: {
        kind: 'at',
        at: '2026-06-08T10:00:00.000Z',
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: 'follow up tomorrow',
      },
      delivery: {
        mode: 'announce',
        channel: 'wecom-openclaw-plugin',
        to: 'room-99',
      },
      agentId: 'main',
    });
  });

  it('builds managed main-session tasks when no channel delivery target is available', async () => {
    const { deps, addJob } = createDeps();
    addJob.mockResolvedValue({
      id: 'task-2',
      name: 'Reminder',
      agentId: 'main',
      sessionKey: 'agent:main:agora:session-2',
      payload: {
        kind: 'systemEvent',
        text: 'remember this',
      },
      schedule: {
        kind: 'at',
        at: '2026-06-09T09:30:00.000Z',
      },
    });
    const handler = createIMGatewayScheduledTaskHandler(deps as never);

    await expect(
      handler({
        sessionId: 'session-2',
        message: {
          platform: 'telegram',
          conversationId: undefined,
        },
        request: {
          taskName: 'Reminder',
          scheduleAt: '2026-06-09T09:30:00.000Z',
          payloadText: 'remember this',
        },
      } as never),
    ).resolves.toEqual({
      id: 'task-2',
      name: 'Reminder',
      agentId: 'main',
      sessionKey: 'agent:main:agora:session-2',
      payloadText: 'remember this',
      scheduleAt: '2026-06-09T09:30:00.000Z',
    });

    expect(addJob).toHaveBeenCalledWith({
      name: 'Reminder',
      description: '',
      enabled: true,
      schedule: {
        kind: 'at',
        at: '2026-06-09T09:30:00.000Z',
      },
      sessionTarget: 'main',
      wakeMode: 'now',
      payload: {
        kind: 'systemEvent',
        text: 'remember this',
      },
      delivery: {
        channel: 'telegram',
        mode: 'none',
      },
      agentId: 'main',
      sessionKey: 'agent:main:agora:session-2',
    });
  });
});
