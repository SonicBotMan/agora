import type { SqliteStore } from './sqliteStore';

export type EnterpriseMcpServerRecord = {
  id: string;
  name: string;
};

export type EnterpriseMcpServerInput = {
  name: string;
  description?: string;
  transportType: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};

export type EnterpriseConfigMcpServer = {
  name: string;
  description: string;
  transportType: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};

export interface EnterpriseStartupMcpStore {
  listServers: () => EnterpriseMcpServerRecord[];
  updateServer: (id: string, input: EnterpriseMcpServerInput) => void;
  createServer: (input: EnterpriseMcpServerInput) => void;
  deleteServer: (id: string) => void;
}

export function syncEnterpriseMcpServerByName(
  mcpStore: EnterpriseStartupMcpStore,
  server: EnterpriseConfigMcpServer,
): void {
  const input = {
    name: server.name,
    description: server.description,
    transportType: server.transportType as 'stdio' | 'sse' | 'http',
    command: server.command,
    args: server.args,
    env: server.env,
  };
  const existing = mcpStore
    .listServers()
    .find((item) => item.name === server.name);

  if (existing) {
    mcpStore.updateServer(existing.id, input);
    return;
  }

  mcpStore.createServer(input);
}

export function clearEnterpriseMcpServers(
  mcpStore: EnterpriseStartupMcpStore,
): void {
  for (const server of mcpStore.listServers()) {
    mcpStore.deleteServer(server.id);
  }
}

export function clearEnterpriseStartupState(
  store: Pick<SqliteStore, 'get' | 'delete'>,
  setCoworkConfig: (config: { executionMode?: 'local' }) => void,
): boolean {
  const hadEnterprise = store.get('enterprise_config');
  if (!hadEnterprise) {
    return false;
  }

  store.delete('enterprise_config');
  setCoworkConfig({ executionMode: 'local' });
  console.log(
    '[Enterprise] config package removed, cleared enterprise mode and reset executionMode',
  );
  return true;
}
