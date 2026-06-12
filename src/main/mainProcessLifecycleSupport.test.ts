import { describe, expect, it, vi } from 'vitest';

import {
  registerMainProcessLifecycleHandlers,
  shouldReloadForChildProcessGone,
  shouldReloadForRenderProcessGone,
} from './mainProcessLifecycleSupport';

describe('mainProcessLifecycleSupport', () => {
  it('identifies reload-worthy render process reasons', () => {
    expect(shouldReloadForRenderProcessGone('crashed')).toBe(true);
    expect(shouldReloadForRenderProcessGone('oom')).toBe(true);
    expect(shouldReloadForRenderProcessGone('clean-exit')).toBe(false);
  });

  it('identifies reload-worthy child process failures', () => {
    expect(
      shouldReloadForChildProcessGone(true, {
        type: 'GPU',
        reason: 'crashed',
      }),
    ).toBe(true);
    expect(
      shouldReloadForChildProcessGone(false, {
        type: 'GPU',
        reason: 'crashed',
      }),
    ).toBe(false);
    expect(
      shouldReloadForChildProcessGone(true, {
        type: 'Broker',
        reason: 'crashed',
      }),
    ).toBe(false);
  });

  it('registers app lifecycle handlers and forwards reload-worthy crashes', () => {
    const appHandlers: Record<string, (...args: unknown[]) => void> = {};
    const processHandlers: Record<string, (...args: unknown[]) => void> = {};
    const scheduleReload = vi.fn();

    registerMainProcessLifecycleHandlers(
      {
        configureHostResolver: vi.fn(),
        isReady: () => false,
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          appHandlers[event] = handler;
        }),
      } as never,
      { scheduleReload },
      {
        reloadOnChildProcessGone: true,
        processApi: {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            processHandlers[event] = handler;
            return process as never;
          }),
        },
      },
    );

    expect(appHandlers.ready).toBeTypeOf('function');
    expect(appHandlers['render-process-gone']).toBeTypeOf('function');
    expect(appHandlers['child-process-gone']).toBeTypeOf('function');
    expect(processHandlers.uncaughtException).toBeTypeOf('function');
    expect(processHandlers.unhandledRejection).toBeTypeOf('function');
    expect(processHandlers.exit).toBeTypeOf('function');

    const webContents = { id: 1 } as never;
    appHandlers['render-process-gone'](
      null,
      webContents,
      { reason: 'crashed' },
    );
    appHandlers['child-process-gone'](null, {
      type: 'GPU',
      reason: 'killed',
    });

    expect(scheduleReload).toHaveBeenNthCalledWith(
      1,
      'render-process-gone (crashed)',
      webContents,
    );
    expect(scheduleReload).toHaveBeenNthCalledWith(
      2,
      'child-process-gone (GPU/killed)',
    );
  });
});
