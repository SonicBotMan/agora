import { getCronJobService } from './ipcHandlers/scheduledTask';
import { stopCoworkOpenAICompatProxy } from './libs/coworkOpenAICompatProxy';
import { stopOpenClawTokenProxy } from './libs/openclawTokenProxy';
import type { MainBootstrapWiringDeps } from './mainBootstrapWiringSupport';
import type { SingleInstanceAppBootstrapDeps } from './singleInstanceAppBootstrap';
import { getSkillServiceManager } from './skillServices';
import { destroyTray } from './trayManager';

export function createAppCleanupDeps(
  deps: MainBootstrapWiringDeps,
): SingleInstanceAppBootstrapDeps['appCleanup'] {
  const { runtime, state } = deps;

  return {
    markQuitting: state.markQuitting,
    shutdown: {
      destroyTray,
      stopHermesIMSessionSyncPolling: runtime.stopHermesIMSessionSyncPolling,
      stopSkillWatcher: () => {
        runtime.peekSkillManager()?.stopWatching();
      },
      stopCoworkSessions: () => {
        const router = runtime.peekCoworkEngineRouter();
        if (router) {
          console.log('[Main] Stopping cowork sessions...');
          router.stopAllSessions();
        }
      },
      stopCoworkFileActivity: () => {
        runtime.peekCoworkRuntimeForwarder()?.stopFileActivity();
      },
      stopCoworkOpenAICompatProxy,
      stopOpenClawTokenProxy,
      stopSkillServices: async () => {
        await getSkillServiceManager().stopAll();
      },
      stopIMGateways: async () => {
        const manager = runtime.peekIMGatewayManager();
        if (manager) {
          await manager.stopAll();
        }
      },
      stopOpenClawGateway: async () => {
        const manager = runtime.peekOpenClawEngineManager();
        if (manager) {
          await manager.stopGateway();
        }
      },
      stopMcpBridge: () => runtime.getMcpBridgeRuntime().stopBridge(),
      stopCronPolling: () => {
        getCronJobService().stopPolling();
      },
      closeStore: () => {
        runtime.getStore().close();
      },
    },
  };
}
