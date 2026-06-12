import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./libs/enterpriseConfigSync', () => ({
  resolveEnterpriseConfigPath: vi.fn(),
  syncEnterpriseConfig: vi.fn(),
}));

import { bootstrapEnterpriseStartup } from './enterpriseStartupBootstrap';
import {
  resolveEnterpriseConfigPath,
  syncEnterpriseConfig,
} from './libs/enterpriseConfigSync';

describe('enterpriseStartupBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires enterprise config sync through IM, cowork, and MCP stores', () => {
    vi.mocked(resolveEnterpriseConfigPath).mockReturnValue('/enterprise');

    const store = {
      get: vi.fn(),
      delete: vi.fn(),
    };
    const coworkStore = {
      setConfig: vi.fn(),
      getConfig: vi.fn().mockReturnValue({ workingDirectory: '/workspace' }),
    };
    const imStore = { id: 'im-store' };
    const mcpStore = {
      listServers: vi.fn().mockReturnValue([]),
      updateServer: vi.fn(),
      createServer: vi.fn(),
      deleteServer: vi.fn(),
    };

    bootstrapEnterpriseStartup({
      store: store as never,
      getCoworkStore: () => coworkStore,
      getIMGatewayManager: () => ({
        getIMStore: () => imStore as never,
      }),
      getMcpStore: () => mcpStore,
    });

    expect(syncEnterpriseConfig).toHaveBeenCalledTimes(1);
    const [
      configPath,
      syncedStore,
      syncedImStore,
      upsertServer,
      clearServers,
      setCoworkConfig,
      getWorkingDirectory,
    ] = vi.mocked(syncEnterpriseConfig).mock.calls[0];

    expect(configPath).toBe('/enterprise');
    expect(syncedStore).toBe(store);
    expect(syncedImStore).toBe(imStore);

    upsertServer({
      name: 'alpha',
      description: 'desc',
      transportType: 'stdio',
      command: 'agent',
      args: ['run'],
      env: { TOKEN: 'value' },
    });
    expect(mcpStore.createServer).toHaveBeenCalledWith({
      name: 'alpha',
      description: 'desc',
      transportType: 'stdio',
      command: 'agent',
      args: ['run'],
      env: { TOKEN: 'value' },
    });

    clearServers();
    expect(mcpStore.listServers).toHaveBeenCalledTimes(2);

    setCoworkConfig({ executionMode: 'local' });
    expect(coworkStore.setConfig).toHaveBeenCalledWith({
      executionMode: 'local',
    });
    expect(getWorkingDirectory()).toBe('/workspace');
  });

  it('logs and swallows enterprise sync failures', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(resolveEnterpriseConfigPath).mockReturnValue('/enterprise');
    vi.mocked(syncEnterpriseConfig).mockImplementation(() => {
      throw new Error('sync failed');
    });

    bootstrapEnterpriseStartup({
      store: {} as never,
      getCoworkStore: () => ({
        setConfig: vi.fn(),
        getConfig: vi.fn().mockReturnValue({ workingDirectory: '/workspace' }),
      }),
      getIMGatewayManager: () => ({
        getIMStore: vi.fn(),
      }),
      getMcpStore: () => ({
        listServers: vi.fn(),
        updateServer: vi.fn(),
        createServer: vi.fn(),
        deleteServer: vi.fn(),
      }),
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[Enterprise] config sync failed:',
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('clears enterprise mode when no enterprise config package remains', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(resolveEnterpriseConfigPath).mockReturnValue(null);

    const store = {
      get: vi.fn().mockReturnValue({ version: '1.0.0' }),
      delete: vi.fn(),
    };
    const coworkStore = {
      setConfig: vi.fn(),
      getConfig: vi.fn(),
    };

    bootstrapEnterpriseStartup({
      store: store as never,
      getCoworkStore: () => coworkStore,
      getIMGatewayManager: () => ({
        getIMStore: vi.fn(),
      }),
      getMcpStore: () => ({
        listServers: vi.fn(),
        updateServer: vi.fn(),
        createServer: vi.fn(),
        deleteServer: vi.fn(),
      }),
    });

    expect(store.delete).toHaveBeenCalledWith('enterprise_config');
    expect(coworkStore.setConfig).toHaveBeenCalledWith({
      executionMode: 'local',
    });
    expect(logSpy).toHaveBeenCalledWith(
      '[Enterprise] config package removed, cleared enterprise mode and reset executionMode',
    );

    logSpy.mockRestore();
  });
});
