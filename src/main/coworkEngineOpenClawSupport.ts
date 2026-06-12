import {
  createOpenClawConfigSupport,
} from './coworkEngineOpenClawConfigSupport';
import type {
  OpenClawEngineSupport,
  OpenClawEngineSupportDeps,
} from './coworkEngineOpenClawContract';
import {
  createOpenClawEngineLifecycleSupport,
} from './coworkEngineOpenClawLifecycleSupport';
import {
  OpenClawEngineManager,
  type OpenClawEngineStatus,
} from './libs/openclawEngineManager';

export type { SyncOpenClawConfigResult } from './coworkEngineOpenClawConfigSupport';
export type {
  OpenClawEngineSupport,
  OpenClawEngineSupportDeps,
} from './coworkEngineOpenClawContract';

export function createOpenClawEngineSupport(
  deps: OpenClawEngineSupportDeps,
): OpenClawEngineSupport {
  let openClawEngineManager: OpenClawEngineManager | null = null;
  let openClawStatusForwarderBound = false;

  const broadcastOpenClawStatus = (
    status: OpenClawEngineStatus,
  ): void => {
    deps.getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send('openclaw:engine:onProgress', status);
      } catch (error) {
        console.error('Failed to forward OpenClaw engine status:', error);
      }
    });
  };

  const getOpenClawEngineManager = (): OpenClawEngineManager => {
    if (!openClawEngineManager) {
      openClawEngineManager = new OpenClawEngineManager();
    }
    return openClawEngineManager;
  };

  const bindOpenClawStatusForwarder = (): void => {
    if (openClawStatusForwarderBound) return;
    const manager = getOpenClawEngineManager();
    manager.on('status', (status) => {
      broadcastOpenClawStatus(status);
    });
    openClawStatusForwarderBound = true;
    broadcastOpenClawStatus(manager.getStatus());
  };
  const {
    getOpenClawConfigSync,
    syncOpenClawConfig,
    detectLocalOpenClawFeishu,
    hasLocalOpenClawFeishuConfigured,
  } = createOpenClawConfigSupport({
    getStore: deps.getStore,
    getCoworkStore: deps.getCoworkStore,
    getSkillManager: deps.getSkillManager,
    getIMGatewayManager: deps.getIMGatewayManager,
    getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
    resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    getOpenClawRuntimeAdapter: deps.getOpenClawRuntimeAdapter,
    getCronJobService: deps.getCronJobService,
    getMcpBridgeConfig: deps.getMcpBridgeConfig,
    getOpenClawEngineManager,
  });
  const {
    bootstrapOpenClawEngine,
    getPendingTokenRefresh,
    setPendingTokenRefresh,
    ensureOpenClawRunningForCowork,
  } = createOpenClawEngineLifecycleSupport({
    getCoworkStore: deps.getCoworkStore,
    startMcpBridge: deps.startMcpBridge,
    getMcpBridgeConfig: deps.getMcpBridgeConfig,
    ensureDefaultIdentity: deps.ensureDefaultIdentity,
    getOpenClawEngineManager,
    bindOpenClawStatusForwarder,
    syncOpenClawConfig,
  });

  return {
    peekOpenClawEngineManager: () => openClawEngineManager,
    getOpenClawEngineManager,
    getOpenClawConfigSync,
    bindOpenClawStatusForwarder,
    bootstrapOpenClawEngine,
    syncOpenClawConfig,
    getPendingTokenRefresh,
    setPendingTokenRefresh,
    ensureOpenClawRunningForCowork,
    detectLocalOpenClawFeishu,
    hasLocalOpenClawFeishuConfigured,
  };
}
