vi.mock('electron', () => ({
  net: { id: 'net' },
  protocol: { id: 'protocol' },
}));

vi.mock('./coreAppStartupBootstrapSupport', () => ({
  ensureDefaultProjectDirectory: vi.fn(),
  registerLocalfileProtocol: vi.fn(),
  resetStartupRuntimeState: vi.fn(),
}));

vi.mock('./libs/claudeSettings', () => ({
  setStoreGetter: vi.fn(),
}));

vi.mock('./libs/endpoints', () => ({
  refreshEndpointsTestMode: vi.fn(),
}));

import { net, protocol } from 'electron';
import fs from 'fs';
import os from 'os';
import { describe, expect, it, vi } from 'vitest';

import { bootstrapCoreAppStartup } from './coreAppStartupBootstrap';
import {
  ensureDefaultProjectDirectory,
  registerLocalfileProtocol,
  resetStartupRuntimeState,
} from './coreAppStartupBootstrapSupport';
import { setStoreGetter } from './libs/claudeSettings';
import { refreshEndpointsTestMode } from './libs/endpoints';

describe('coreAppStartupBootstrap', () => {
  it('orchestrates startup helpers around store initialization', async () => {
    const store = { id: 'store' };
    const initStore = vi.fn().mockResolvedValue(store);
    const getCoworkStore = vi.fn();
    const getRuntimeTelemetryStore = vi.fn();

    const result = await bootstrapCoreAppStartup({
      initStore,
      getCoworkStore,
      getRuntimeTelemetryStore,
    } as never);

    expect(ensureDefaultProjectDirectory).toHaveBeenCalledWith(os.homedir(), fs);
    expect(registerLocalfileProtocol).toHaveBeenCalledWith(protocol, net);
    expect(initStore).toHaveBeenCalledTimes(1);
    expect(refreshEndpointsTestMode).toHaveBeenCalledWith(store);
    expect(resetStartupRuntimeState).toHaveBeenCalledWith({
      getCoworkStore,
      getRuntimeTelemetryStore,
    });
    expect(setStoreGetter).toHaveBeenCalledWith(expect.any(Function));
    expect(vi.mocked(setStoreGetter).mock.calls[0]?.[0]()).toBe(store);
    expect(result).toBe(store);
  });
});
