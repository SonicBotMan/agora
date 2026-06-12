import os from 'os';

import { CoworkAgentEngine as CoworkAgentEngineValue } from '../shared/cowork/constants';
import type { CoworkStore } from './coworkStore';
import type { IMGatewayManager } from './im';
import {
  type CoworkAgentEngine,
  CoworkEngineRouter,
  DeepSeekTuiRuntimeAdapter,
  ExternalCliRuntimeAdapter,
  HermesRuntimeAdapter,
  OpenClawRuntimeAdapter,
} from './libs/agentEngine';
import { CoworkRunner } from './libs/coworkRunner';
import type { DeepSeekTuiRuntimeManager } from './libs/deepSeekTuiRuntimeManager';
import type { ExternalAgentProviderStore } from './libs/externalAgentProviderStore';
import type { HermesEngineManager, HermesEngineStatus } from './libs/hermesEngineManager';
import { OpenClawChannelSessionSync } from './libs/openclawChannelSessionSync';
import type { OpenClawEngineManager } from './libs/openclawEngineManager';
import type { RuntimeTelemetryTracker } from './libs/runtimeTelemetryTracker';
import type { McpStore } from './mcpStore';

type CronJobServiceLike = {
  getJobNameSync: (jobId: string) => string;
};

export interface CoworkRouterRuntimeDeps {
  getCoworkStore: () => CoworkStore;
  getOpenClawEngineManager: () => OpenClawEngineManager;
  getHermesEngineManager: () => HermesEngineManager;
  getDeepSeekTuiRuntimeManager: () => DeepSeekTuiRuntimeManager;
  getExternalAgentProviderStore: () => ExternalAgentProviderStore;
  ensureHermesRunningForCowork: () => Promise<HermesEngineStatus>;
  resolveCoworkAgentEngine: () => CoworkAgentEngine;
  getRuntimeTelemetryTracker: () => RuntimeTelemetryTracker;
  getIMGatewayManager: () => IMGatewayManager;
  getCronJobService: () => CronJobServiceLike;
  getEnabledMcpServers: () => ReturnType<McpStore['getEnabledServers']>;
}

export interface CoworkRouterRuntime {
  peekCoworkRunner: () => CoworkRunner | null;
  getCoworkRunner: () => CoworkRunner;
  peekCoworkEngineRouter: () => CoworkEngineRouter | null;
  getCoworkEngineRouter: () => CoworkEngineRouter;
  peekOpenClawRuntimeAdapter: () => OpenClawRuntimeAdapter | null;
}

export function createCoworkRouterRuntime(
  deps: CoworkRouterRuntimeDeps,
): CoworkRouterRuntime {
  let coworkRunner: CoworkRunner | null = null;
  let openClawRuntimeAdapter: OpenClawRuntimeAdapter | null = null;
  let hermesRuntimeAdapter: HermesRuntimeAdapter | null = null;
  let claudeCodeRuntimeAdapter: ExternalCliRuntimeAdapter | null = null;
  let codexRuntimeAdapter: ExternalCliRuntimeAdapter | null = null;
  let openCodeRuntimeAdapter: ExternalCliRuntimeAdapter | null = null;
  let deepSeekTuiRuntimeAdapter: DeepSeekTuiRuntimeAdapter | null = null;
  let coworkEngineRouter: CoworkEngineRouter | null = null;

  const getCoworkRunner = (): CoworkRunner => {
    if (!coworkRunner) {
      coworkRunner = new CoworkRunner(deps.getCoworkStore());
      coworkRunner.setMcpServerProvider(() => deps.getEnabledMcpServers());
    }
    return coworkRunner;
  };

  const getCoworkEngineRouter = (): CoworkEngineRouter => {
    if (!coworkEngineRouter) {
      if (!openClawRuntimeAdapter) {
        openClawRuntimeAdapter = new OpenClawRuntimeAdapter(
          deps.getCoworkStore(),
          deps.getOpenClawEngineManager(),
        );
        try {
          const imManager = deps.getIMGatewayManager();
          const imStore = imManager.getIMStore();
          if (imStore) {
            const channelSessionSync = new OpenClawChannelSessionSync({
              coworkStore: deps.getCoworkStore(),
              imStore,
              getDefaultCwd: () =>
                deps.getCoworkStore().getConfig().workingDirectory || os.homedir(),
              resolveJobName: (jobId) =>
                deps.getCronJobService().getJobNameSync(jobId),
            });
            openClawRuntimeAdapter.setChannelSessionSync(channelSessionSync);
          }
        } catch (error) {
          console.warn('[Main] Failed to set up channel session sync:', error);
        }
      }
      if (!claudeCodeRuntimeAdapter) {
        claudeCodeRuntimeAdapter = new ExternalCliRuntimeAdapter({
          engine: CoworkAgentEngineValue.ClaudeCode,
          store: deps.getCoworkStore(),
          getCurrentProvider: (appType) =>
            deps.getExternalAgentProviderStore().getCurrentProvider(appType),
        });
      }
      if (!codexRuntimeAdapter) {
        codexRuntimeAdapter = new ExternalCliRuntimeAdapter({
          engine: CoworkAgentEngineValue.Codex,
          store: deps.getCoworkStore(),
          getCurrentProvider: (appType) =>
            deps.getExternalAgentProviderStore().getCurrentProvider(appType),
        });
      }
      if (!openCodeRuntimeAdapter) {
        openCodeRuntimeAdapter = new ExternalCliRuntimeAdapter({
          engine: CoworkAgentEngineValue.OpenCode,
          store: deps.getCoworkStore(),
          getCurrentProvider: (appType) =>
            deps.getExternalAgentProviderStore().getCurrentProvider(appType),
        });
      }
      if (!deepSeekTuiRuntimeAdapter) {
        deepSeekTuiRuntimeAdapter = new DeepSeekTuiRuntimeAdapter({
          store: deps.getCoworkStore(),
          runtimeManager: deps.getDeepSeekTuiRuntimeManager(),
          getCurrentProvider: (appType) =>
            deps.getExternalAgentProviderStore().getCurrentProvider(appType),
        });
      }
      if (!hermesRuntimeAdapter) {
        hermesRuntimeAdapter = new HermesRuntimeAdapter({
          store: deps.getCoworkStore(),
          engineManager: deps.getHermesEngineManager(),
          ensureRunning: deps.ensureHermesRunningForCowork,
        });
      }
      coworkEngineRouter = new CoworkEngineRouter({
        getCurrentEngine: deps.resolveCoworkAgentEngine,
        openclawRuntime: openClawRuntimeAdapter,
        hermesRuntime: hermesRuntimeAdapter,
        claudeCodeRuntime: claudeCodeRuntimeAdapter,
        codexRuntime: codexRuntimeAdapter,
        openCodeRuntime: openCodeRuntimeAdapter,
        deepSeekTuiRuntime: deepSeekTuiRuntimeAdapter,
        telemetryTracker: deps.getRuntimeTelemetryTracker(),
      });
    }
    return coworkEngineRouter;
  };

  return {
    peekCoworkRunner: () => coworkRunner,
    getCoworkRunner,
    peekCoworkEngineRouter: () => coworkEngineRouter,
    getCoworkEngineRouter,
    peekOpenClawRuntimeAdapter: () => openClawRuntimeAdapter,
  };
}
