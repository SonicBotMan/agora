import type { BrowserWindow } from 'electron';

import {
  CoworkAgentEngine as CoworkAgentEngineValue,
  CoworkIpcChannel,
  isCoworkAgentEngine,
  isOpenClawCoworkAgentEngine,
} from '../shared/cowork/constants';
import { AgentManager } from './agentManager';
import type { CoworkStore } from './coworkStore';
import type { CoworkAgentEngine } from './libs/agentEngine';
import type {
  ExternalAgentCliInstaller,
  ExternalAgentCliInstallProgress,
} from './libs/externalAgentCliInstaller';
import type { HermesConfigSync } from './libs/hermesConfigSync';
import type { HermesEngineManager, HermesEngineStatus } from './libs/hermesEngineManager';
import type { OpenClawEngineStatus } from './libs/openclawEngineManager';

type SyncEngineStatus = OpenClawEngineStatus | HermesEngineStatus;

type AgentTeamRunnerLike = {
  run: (opts: {
    teamId: string;
    parentSessionId: string;
    prompt: string;
    runtimeSource: string;
  }) => Promise<void>;
};

export interface CoworkAgentRuntimeDeps {
  getWindows: () => BrowserWindow[];
  getCoworkStore: () => CoworkStore;
  getExternalAgentCliInstaller: () => ExternalAgentCliInstaller;
  getHermesEngineManager: () => HermesEngineManager;
  getHermesConfigSync: () => HermesConfigSync;
  ensureOpenClawRunningForCowork: () => Promise<OpenClawEngineStatus>;
  ensureHermesRunningForCowork: () => Promise<HermesEngineStatus>;
  applyExternalAgentConfigForEngine: (
    engine: CoworkAgentEngine,
    source: unknown,
  ) => void;
}

export interface CoworkAgentRuntime {
  getAgentManager: () => AgentManager;
  getAgentTeamRunner: () => AgentTeamRunnerLike;
  resolveCoworkAgentEngine: () => CoworkAgentEngine;
  resolveAgentRuntimeEngine: (agentId?: string | null) => CoworkAgentEngine;
  bindExternalAgentCliInstallerForwarder: () => void;
  applyExternalAgentConfigSourceForEngine: (
    engine: CoworkAgentEngine,
  ) => void;
  ensureCoworkEngineReady: (engine: CoworkAgentEngine) => Promise<{
    success: boolean;
    error?: string;
    engineStatus?: SyncEngineStatus;
  }>;
}

export function createCoworkAgentRuntime(
  deps: CoworkAgentRuntimeDeps,
): CoworkAgentRuntime {
  let externalAgentCliInstallerForwarderBound = false;
  let agentManager: AgentManager | null = null;

  const getAgentManager = (): AgentManager => {
    if (!agentManager) {
      agentManager = new AgentManager(deps.getCoworkStore());
    }
    return agentManager;
  };

  const resolveCoworkAgentEngine = (): CoworkAgentEngine => {
    const configured = deps.getCoworkStore().getConfig().agentEngine;
    return isCoworkAgentEngine(configured)
      ? configured
      : CoworkAgentEngineValue.ClaudeCode;
  };

  const resolveAgentRuntimeEngine = (
    agentId?: string | null,
  ): CoworkAgentEngine => {
    const fallback = resolveCoworkAgentEngine();
    if (!agentId || agentId === 'main') {
      return fallback;
    }
    const agent = getAgentManager().getAgent(agentId);
    if (agent?.agentEngine && isCoworkAgentEngine(agent.agentEngine)) {
      return agent.agentEngine;
    }
    return fallback;
  };

  const forwardExternalAgentCliInstallProgress = (
    progress: ExternalAgentCliInstallProgress,
  ): void => {
    deps.getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send(CoworkIpcChannel.AgentCliInstallProgress, progress);
      } catch (error) {
        console.error(
          '[ExternalAgentCliInstaller] failed to forward install progress:',
          error,
        );
      }
    });
  };

  const bindExternalAgentCliInstallerForwarder = (): void => {
    if (externalAgentCliInstallerForwarderBound) return;
    deps.getExternalAgentCliInstaller().onProgress((progress) => {
      if (progress.appType === 'hermes') {
        deps.getHermesEngineManager().reportInstallProgress(progress);
      }
      forwardExternalAgentCliInstallProgress(progress);
    });
    externalAgentCliInstallerForwarderBound = true;
  };

  const getAgentTeamRunner = (): AgentTeamRunnerLike => {
    return {
      run: async () => {
        // No-op: team execution is not yet reintroduced in Agora.
      },
    };
  };

  const applyExternalAgentConfigSourceForEngine = (
    engine: CoworkAgentEngine,
  ): void => {
    const config = deps.getCoworkStore().getConfig();
    if (engine === CoworkAgentEngineValue.OpenClaw) {
      return;
    }
    if (engine === CoworkAgentEngineValue.ClaudeCode) {
      deps.applyExternalAgentConfigForEngine(
        engine,
        config.claudeCodeConfigSource,
      );
      return;
    }
    if (engine === CoworkAgentEngineValue.Codex) {
      deps.applyExternalAgentConfigForEngine(engine, config.codexConfigSource);
      return;
    }
    if (engine === CoworkAgentEngineValue.Hermes) {
      deps.getHermesConfigSync().sync('external-agent-config-source');
      return;
    }
    if (engine === CoworkAgentEngineValue.OpenCode) {
      deps.applyExternalAgentConfigForEngine(
        engine,
        config.opencodeConfigSource,
      );
      return;
    }
    if (engine === CoworkAgentEngineValue.DeepSeekTui) {
      deps.applyExternalAgentConfigForEngine(
        engine,
        config.deepseekTuiConfigSource,
      );
    }
  };

  const ensureCoworkEngineReady = async (
    engine: CoworkAgentEngine,
  ): Promise<{
    success: boolean;
    error?: string;
    engineStatus?: SyncEngineStatus;
  }> => {
    if (isOpenClawCoworkAgentEngine(engine)) {
      const engineStatus = await deps.ensureOpenClawRunningForCowork();
      if (engineStatus.phase !== 'running') {
        return {
          success: false,
          error: engineStatus.message || 'OpenClaw runtime is not ready.',
          engineStatus,
        };
      }
    }
    if (engine === CoworkAgentEngineValue.Hermes) {
      const engineStatus = await deps.ensureHermesRunningForCowork();
      if (engineStatus.phase !== 'running') {
        return {
          success: false,
          error: engineStatus.message || 'Hermes runtime is not ready.',
          engineStatus,
        };
      }
    }
    return { success: true };
  };

  return {
    getAgentManager,
    getAgentTeamRunner,
    resolveCoworkAgentEngine,
    resolveAgentRuntimeEngine,
    bindExternalAgentCliInstallerForwarder,
    applyExternalAgentConfigSourceForEngine,
    ensureCoworkEngineReady,
  };
}
