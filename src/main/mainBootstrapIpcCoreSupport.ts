import { t } from './i18n';
import {
  clearServerModelMetadata,
  updateServerModelMetadata,
} from './libs/claudeSettings';
import {
  getServerApiBaseUrl,
  refreshEndpointsTestMode,
} from './libs/endpoints';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { MainIpcBootstrapInputDeps } from './mainIpcBootstrap';
import type { MainIpcCoreBuilderDeps } from './mainIpcCoreSupport';

export type MainBootstrapIpcCoreBuilderDeps = MainIpcCoreBuilderDeps
  & Pick<MainIpcBootstrapInputDeps, 'onNetworkOnline'>;

export function createMainIpcCoreBuilderDeps(
  deps: MainBootstrapWiringDeps,
): MainBootstrapIpcCoreBuilderDeps {
  const { runtime, state } = deps;

  return {
    getMainWindow: state.getMainWindow,
    getStore: runtime.getStore,
    onNetworkOnline: () => {
      const manager = runtime.peekIMGatewayManager();
      if (manager) {
        manager.reconnectAllDisconnected();
      }
    },
    onAppConfigChanged: async () => {
      refreshEndpointsTestMode(runtime.getStore());
      const syncResult = await runtime.syncOpenClawConfig({
        reason: 'app-config-change',
        restartGatewayIfRunning: false,
      });
      if (!syncResult.success) {
        console.error(
          '[OpenClaw] Failed to sync config after app_config update:',
          syncResult.error,
        );
      }
    },
    shellNormalizeShellPath: deps.normalizeShellPath,
    getServerApiBaseUrl,
    clearServerModelMetadata,
    updateServerModelMetadata,
    t,
    getSkillManager: runtime.getSkillManager,
  };
}
