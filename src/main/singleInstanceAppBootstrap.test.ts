import { describe, expect, it, vi } from 'vitest';

vi.mock('./singleInstanceAppBootstrapRuntimeSupport', () => ({
  runSingleInstanceAppBootstrap: vi.fn(),
}));

import { bootstrapSingleInstanceApp } from './singleInstanceAppBootstrap';
import { runSingleInstanceAppBootstrap } from './singleInstanceAppBootstrapRuntimeSupport';

describe('singleInstanceAppBootstrap', () => {
  it('quits the app when the single-instance lock cannot be acquired', () => {
    const deps = {
      app: {
        requestSingleInstanceLock: vi.fn().mockReturnValue(false),
        quit: vi.fn(),
      },
    };

    bootstrapSingleInstanceApp(deps as never);

    expect(deps.app.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(deps.app.quit).toHaveBeenCalledTimes(1);
    expect(runSingleInstanceAppBootstrap).not.toHaveBeenCalled();
  });

  it('runs the single-instance bootstrap when the lock is acquired', () => {
    const deps = {
      app: {
        requestSingleInstanceLock: vi.fn().mockReturnValue(true),
        quit: vi.fn(),
      },
    };

    bootstrapSingleInstanceApp(deps as never);

    expect(deps.app.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(deps.app.quit).not.toHaveBeenCalled();
    expect(runSingleInstanceAppBootstrap).toHaveBeenCalledWith(deps);
  });
});
