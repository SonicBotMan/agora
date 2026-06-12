import { IMGatewayManager } from './im';
import {
  createIMGatewayFeishuSupport,
  createIMGatewayManager,
  createIMGatewayScheduledTaskHandler,
  type IMGatewayRuntime,
  type IMGatewayRuntimeDeps,
} from './imGatewayRuntimeSupport';
export type { IMGatewayRuntime, IMGatewayRuntimeDeps } from './imGatewayRuntimeSupport';

export function createIMGatewayRuntime(
  deps: IMGatewayRuntimeDeps,
): IMGatewayRuntime {
  let imGatewayManager: IMGatewayManager | null = null;
  const getIMGatewayManager = (): IMGatewayManager => {
    if (!imGatewayManager) {
      imGatewayManager = createIMGatewayManager({
        deps,
        support: {
          ensureCoworkReady,
          resolveFeishuIMAgentEngine,
          resolveFeishuEngineKey,
          getFeishuManagementMode,
          getFeishuRuntimeOwnership,
        },
        createScheduledTask,
      });
    }
    return imGatewayManager;
  };

  const feishuSupport = createIMGatewayFeishuSupport({
    getIMGatewayManager,
    resolveCoworkAgentEngine: deps.resolveCoworkAgentEngine,
    ensureOpenClawRunningForCowork: deps.ensureOpenClawRunningForCowork,
    ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
  });
  const createScheduledTask = createIMGatewayScheduledTaskHandler({
    getCronJobService: deps.getCronJobService,
  });
  const {
    resolveFeishuIMAgentEngine,
    resolveFeishuEngineKey,
    normalizeFeishuEngineKey,
    getFeishuManagementMode,
    getFeishuRuntimeOwnership,
    isFeishuEngineManagedByAgora,
    ensureCoworkReady,
  } = feishuSupport;

  return {
    peekIMGatewayManager: () => imGatewayManager,
    getIMGatewayManager,
    resolveFeishuIMAgentEngine,
    normalizeFeishuEngineKey,
    getFeishuManagementMode,
    getFeishuRuntimeOwnership,
    isFeishuEngineManagedByAgora,
  };
}
