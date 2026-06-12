import { beforeEach, describe, expect, it, vi } from 'vitest';

const coworkRuntimeHandlersTestState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const handle = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });

  return {
    handlers,
    handle,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: coworkRuntimeHandlersTestState.handle,
  },
}));

import { registerCoworkRuntimeHandlers } from './coworkRuntimeHandlers';

describe('coworkRuntimeHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coworkRuntimeHandlersTestState.handlers.clear();
  });

  it('routes permission responses through the runtime and shared permission manager', async () => {
    const respondToPermission = vi.fn();
    const approvePermission = vi.fn();
    const denyPermission = vi.fn();

    registerCoworkRuntimeHandlers({
      getCoworkEngineRouter: () => ({
        respondToPermission,
      }) as never,
      getCoworkPermissionManager: () => ({
        approvePermission,
        denyPermission,
        dismissPermission: vi.fn(),
      }) as never,
      getRuntimeTelemetryStore: () => ({
        getSummary: vi.fn(),
        listCalls: vi.fn(),
        getDetail: vi.fn(),
      }) as never,
      getMergedExternalAgentEnvironmentSnapshot: () => ({}),
    });

    const handler = coworkRuntimeHandlersTestState.handlers.get(
      'cowork:permission:respond',
    );
    const allowResult = {
      behavior: 'allow',
      updatedInput: { command: 'ls' },
    };
    const denyResult = {
      behavior: 'deny',
      message: 'No',
    };

    await expect(
      handler?.({}, {
        requestId: 'perm-1',
        result: allowResult,
      }),
    ).resolves.toEqual({ success: true });
    await expect(
      handler?.({}, {
        requestId: 'perm-2',
        result: denyResult,
      }),
    ).resolves.toEqual({ success: true });

    expect(respondToPermission).toHaveBeenNthCalledWith(
      1,
      'perm-1',
      allowResult,
    );
    expect(respondToPermission).toHaveBeenNthCalledWith(
      2,
      'perm-2',
      denyResult,
    );
    expect(approvePermission).toHaveBeenCalledWith('perm-1', allowResult);
    expect(denyPermission).toHaveBeenCalledWith('perm-2', denyResult);
  });
});
