import { describe, expect, it, vi } from 'vitest';

import { createScheduledTaskIMGatewayManagerView } from './mainRuntimeRegistryScheduledTaskViewSupport';

describe('mainRuntimeRegistryScheduledTaskViewSupport', () => {
  it('exposes a narrowed IM gateway manager view with normalized session mappings', () => {
    const imStore = {
      getSessionMapping: vi.fn().mockReturnValue({
        coworkSessionId: 'session-1',
        ignored: 'value',
      }),
      listSessionMappings: vi.fn().mockReturnValue([
        {
          conversationId: 'conv-1',
          coworkSessionId: 'session-1',
          lastActiveAt: 1234567890,
        },
      ]),
    };
    const manager = {
      getConfig: vi.fn().mockReturnValue({ enabled: true }),
      getIMStore: vi.fn().mockReturnValue(imStore),
      primeConversationReplyRoute: vi.fn().mockReturnValue('primed'),
    };

    const view = createScheduledTaskIMGatewayManagerView(manager as never);

    expect(view.getConfig()).toEqual({ enabled: true });
    expect(view.getIMStore()?.getSessionMapping('conv-1', 'telegram' as never))
      .toEqual({
        coworkSessionId: 'session-1',
      });
    expect(imStore.getSessionMapping).toHaveBeenCalledWith(
      'conv-1',
      'telegram',
    );
    expect(view.getIMStore()?.listSessionMappings('telegram' as never, 'main'))
      .toEqual([
        {
          conversationId: 'conv-1',
          coworkSessionId: 'session-1',
          lastActiveAt: '1234567890',
        },
      ]);
    expect(imStore.listSessionMappings).toHaveBeenCalledWith(
      'telegram',
      'main',
    );
    expect(
      view.primeConversationReplyRoute('telegram' as never, 'conv-1', 'session-1'),
    ).toBe('primed');
    expect(manager.primeConversationReplyRoute).toHaveBeenCalledWith(
      'telegram',
      'conv-1',
      'session-1',
    );
  });

  it('returns undefined store helpers when the IM store is unavailable', () => {
    const manager = {
      getConfig: vi.fn().mockReturnValue({ enabled: false }),
      getIMStore: vi.fn().mockReturnValue(undefined),
      primeConversationReplyRoute: vi.fn(),
    };

    const view = createScheduledTaskIMGatewayManagerView(manager as never);

    expect(view.getIMStore()).toBeUndefined();
  });
});
