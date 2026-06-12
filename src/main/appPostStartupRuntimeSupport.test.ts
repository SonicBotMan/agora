import { describe, expect, it, vi } from 'vitest';

import { registerResumeLifecycle } from './appPostStartupRuntimeSupport';

describe('appPostStartupRuntimeSupport', () => {
  it('forwards resume events to openclaw runtime adapter', () => {
    let resumeHandler: (() => void) | null = null;
    const onSystemResume = vi.fn();

    registerResumeLifecycle(
      () => ({ onSystemResume }),
      {
        on: (_event, handler) => {
          resumeHandler = handler;
        },
      },
    );

    resumeHandler?.();

    expect(onSystemResume).toHaveBeenCalled();
  });
});
