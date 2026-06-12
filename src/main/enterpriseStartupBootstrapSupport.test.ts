import { describe, expect, it, vi } from 'vitest';

import {
  clearEnterpriseMcpServers,
  clearEnterpriseStartupState,
  syncEnterpriseMcpServerByName,
} from './enterpriseStartupBootstrapSupport';

describe('enterpriseStartupBootstrapSupport', () => {
  it('updates an existing MCP server when the enterprise config matches by name', () => {
    const mcpStore = {
      listServers: vi.fn().mockReturnValue([
        { id: 'srv-1', name: 'alpha' },
      ]),
      updateServer: vi.fn(),
      createServer: vi.fn(),
      deleteServer: vi.fn(),
    };

    syncEnterpriseMcpServerByName(mcpStore, {
      name: 'alpha',
      description: 'updated',
      transportType: 'stdio',
      command: 'agent',
      args: ['run'],
      env: { FOO: 'bar' },
    });

    expect(mcpStore.updateServer).toHaveBeenCalledWith('srv-1', {
      name: 'alpha',
      description: 'updated',
      transportType: 'stdio',
      command: 'agent',
      args: ['run'],
      env: { FOO: 'bar' },
    });
    expect(mcpStore.createServer).not.toHaveBeenCalled();
  });

  it('creates a new MCP server when the enterprise config does not match by name', () => {
    const mcpStore = {
      listServers: vi.fn().mockReturnValue([
        { id: 'srv-1', name: 'alpha' },
      ]),
      updateServer: vi.fn(),
      createServer: vi.fn(),
      deleteServer: vi.fn(),
    };

    syncEnterpriseMcpServerByName(mcpStore, {
      name: 'beta',
      description: 'created',
      transportType: 'http',
      command: undefined,
      args: undefined,
      env: undefined,
    });

    expect(mcpStore.createServer).toHaveBeenCalledWith({
      name: 'beta',
      description: 'created',
      transportType: 'http',
      command: undefined,
      args: undefined,
      env: undefined,
    });
    expect(mcpStore.updateServer).not.toHaveBeenCalled();
  });

  it('clears all enterprise-managed MCP servers', () => {
    const mcpStore = {
      listServers: vi.fn().mockReturnValue([
        { id: 'srv-1', name: 'alpha' },
        { id: 'srv-2', name: 'beta' },
      ]),
      updateServer: vi.fn(),
      createServer: vi.fn(),
      deleteServer: vi.fn(),
    };

    clearEnterpriseMcpServers(mcpStore);

    expect(mcpStore.deleteServer).toHaveBeenCalledWith('srv-1');
    expect(mcpStore.deleteServer).toHaveBeenCalledWith('srv-2');
  });

  it('clears enterprise startup state when enterprise config was previously synced', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const store = {
      get: vi.fn().mockReturnValue({ version: '1.0.0' }),
      delete: vi.fn(),
    };
    const setCoworkConfig = vi.fn();

    expect(clearEnterpriseStartupState(store, setCoworkConfig)).toBe(true);

    expect(store.delete).toHaveBeenCalledWith('enterprise_config');
    expect(setCoworkConfig).toHaveBeenCalledWith({ executionMode: 'local' });
    expect(logSpy).toHaveBeenCalledWith(
      '[Enterprise] config package removed, cleared enterprise mode and reset executionMode',
    );

    logSpy.mockRestore();
  });

  it('no-ops when no enterprise startup state exists', () => {
    const store = {
      get: vi.fn().mockReturnValue(null),
      delete: vi.fn(),
    };
    const setCoworkConfig = vi.fn();

    expect(clearEnterpriseStartupState(store, setCoworkConfig)).toBe(false);
    expect(store.delete).not.toHaveBeenCalled();
    expect(setCoworkConfig).not.toHaveBeenCalled();
  });
});
