import {
  clearEnterpriseMcpServers,
  clearEnterpriseStartupState,
  type EnterpriseStartupMcpStore,
  syncEnterpriseMcpServerByName,
} from './enterpriseStartupBootstrapSupport';
import type { IMStore } from './im/imStore';
import { resolveEnterpriseConfigPath, syncEnterpriseConfig } from './libs/enterpriseConfigSync';
import type { SqliteStore } from './sqliteStore';

export interface EnterpriseStartupBootstrapDeps {
  store: SqliteStore;
  getCoworkStore: () => {
    setConfig: (config: { executionMode?: 'local' }) => void;
    getConfig: () => { workingDirectory: string };
  };
  getIMGatewayManager: () => {
    getIMStore: () => IMStore;
  };
  getMcpStore: () => EnterpriseStartupMcpStore;
}

export function bootstrapEnterpriseStartup(
  deps: EnterpriseStartupBootstrapDeps,
): void {
  const { store, getCoworkStore, getIMGatewayManager, getMcpStore } = deps;

  const enterpriseConfigPath = resolveEnterpriseConfigPath();
  if (enterpriseConfigPath) {
    try {
      const coworkStore = getCoworkStore();
      const imStoreInstance = getIMGatewayManager().getIMStore();
      const mcpStoreInstance = getMcpStore();
      syncEnterpriseConfig(
        enterpriseConfigPath,
        store,
        imStoreInstance,
        (server) => {
          syncEnterpriseMcpServerByName(mcpStoreInstance, server);
        },
        () => clearEnterpriseMcpServers(mcpStoreInstance),
        (config) => {
          coworkStore.setConfig(config);
        },
        () => coworkStore.getConfig().workingDirectory,
      );
    } catch (error) {
      console.error('[Enterprise] config sync failed:', error);
    }
    return;
  }

  clearEnterpriseStartupState(store, (config) => {
    getCoworkStore().setConfig(config);
  });
}
