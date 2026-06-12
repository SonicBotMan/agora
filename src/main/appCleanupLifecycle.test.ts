vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    exit: vi.fn(),
  },
}));

import { app } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerAppCleanupLifecycle } from './appCleanupLifecycle';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('appCleanupLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs cleanup once on before-quit and exits after cleanup finishes', async () => {
    let beforeQuitHandler:
      | ((event: { preventDefault: () => void }) => void)
      | undefined;
    const signalHandlers: Partial<Record<'SIGINT' | 'SIGTERM', () => void>> = {};
    vi.mocked(app.on).mockImplementation((event, handler) => {
      if (event === 'before-quit') {
        beforeQuitHandler = handler as (event: { preventDefault: () => void }) => void;
      }
      return app as never;
    });
    const processOnceSpy = vi.spyOn(process, 'once').mockImplementation(
      ((signal: 'SIGINT' | 'SIGTERM', handler: () => void) => {
        signalHandlers[signal] = handler;
        return process;
      }) as never,
    );
    const cleanup = createDeferred<void>();
    const markQuitting = vi.fn();
    const runCleanup = vi.fn(() => cleanup.promise);

    registerAppCleanupLifecycle({
      markQuitting,
      runCleanup,
    });

    expect(signalHandlers.SIGINT).toBeTypeOf('function');
    expect(signalHandlers.SIGTERM).toBeTypeOf('function');

    const firstEvent = { preventDefault: vi.fn() };
    beforeQuitHandler?.(firstEvent);
    expect(firstEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(markQuitting).toHaveBeenCalledTimes(1);
    expect(runCleanup).toHaveBeenCalledTimes(1);

    const secondEvent = { preventDefault: vi.fn() };
    beforeQuitHandler?.(secondEvent);
    expect(secondEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(runCleanup).toHaveBeenCalledTimes(1);

    cleanup.resolve();
    await cleanup.promise;
    await Promise.resolve();

    expect(app.exit).toHaveBeenCalledWith(0);
    expect(processOnceSpy).toHaveBeenCalledTimes(2);
  });

  it('logs cleanup failures for termination signals and still exits', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const signalHandlers: Partial<Record<'SIGINT' | 'SIGTERM', () => void>> = {};
    vi.mocked(app.on).mockImplementation(() => app as never);
    vi.spyOn(process, 'once').mockImplementation(
      ((signal: 'SIGINT' | 'SIGTERM', handler: () => void) => {
        signalHandlers[signal] = handler;
        return process;
      }) as never,
    );
    const cleanupError = new Error('cleanup failed');
    const markQuitting = vi.fn();
    const runCleanup = vi.fn().mockRejectedValue(cleanupError);

    registerAppCleanupLifecycle({
      markQuitting,
      runCleanup,
    });

    signalHandlers.SIGTERM?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(logSpy).toHaveBeenCalledWith(
      '[Main] Received SIGTERM, running cleanup before exit...',
    );
    expect(markQuitting).toHaveBeenCalledTimes(1);
    expect(runCleanup).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[Main] Cleanup error during SIGTERM:',
      cleanupError,
    );
    expect(app.exit).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
