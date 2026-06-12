import type { BrowserWindow } from 'electron';

import {
  type CoworkAgentRuntime,
  createCoworkAgentRuntime,
} from './coworkAgentRuntime';
import { applyExternalAgentConfigForEngine } from './libs/externalAgentConfigSync';
import type { HermesConfigSync } from './libs/hermesConfigSync';
import type {
  HermesEngineManager,
  HermesEngineStatus,
} from './libs/hermesEngineManager';
import type { OpenClawEngineStatus } from './libs/openclawEngineManager';
import type { MainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';

export interface MainRuntimeRegistryCoworkAgentRuntimeSupportDeps {
  getWindows: () => BrowserWindow[];
  getCoworkStore: MainRuntimeRegistrySupport['getCoworkStore'];
  getExternalAgentCliInstaller: MainRuntimeRegistrySupport['getExternalAgentCliInstaller'];
  getHermesEngineManager: () => HermesEngineManager;
  getHermesConfigSync: () => HermesConfigSync;
  ensureOpenClawRunningForCowork: () => Promise<OpenClawEngineStatus>;
  ensureHermesRunningForCowork: () => Promise<HermesEngineStatus>;
}

export interface MainRuntimeRegistryCoworkAgentRuntimeSupport {
  bindExternalAgentCliInstallerForwarder: CoworkAgentRuntime['bindExternalAgentCliInstallerForwarder'];
  getAgentManager: CoworkAgentRuntime['getAgentManager'];
  getAgentTeamRunner: CoworkAgentRuntime['getAgentTeamRunner'];
  resolveCoworkAgentEngine: CoworkAgentRuntime['resolveCoworkAgentEngine'];
  resolveAgentRuntimeEngine: CoworkAgentRuntime['resolveAgentRuntimeEngine'];
  applyExternalAgentConfigSourceForEngine: CoworkAgentRuntime['applyExternalAgentConfigSourceForEngine'];
  ensureCoworkEngineReady: CoworkAgentRuntime['ensureCoworkEngineReady'];
}

export function createMainRuntimeRegistryCoworkAgentRuntimeSupport(
  deps: MainRuntimeRegistryCoworkAgentRuntimeSupportDeps,
): MainRuntimeRegistryCoworkAgentRuntimeSupport {
  let coworkAgentRuntime: CoworkAgentRuntime | null = null;

  const getCoworkAgentRuntime = (): CoworkAgentRuntime => {
    if (!coworkAgentRuntime) {
      coworkAgentRuntime = createCoworkAgentRuntime({
        getWindows: deps.getWindows,
        getCoworkStore: deps.getCoworkStore,
        getExternalAgentCliInstaller: deps.getExternalAgentCliInstaller,
        getHermesEngineManager: deps.getHermesEngineManager,
        getHermesConfigSync: deps.getHermesConfigSync,
        ensureOpenClawRunningForCowork: deps.ensureOpenClawRunningForCowork,
        ensureHermesRunningForCowork: deps.ensureHermesRunningForCowork,
        applyExternalAgentConfigForEngine,
      });
    }
    return coworkAgentRuntime;
  };

  const bindExternalAgentCliInstallerForwarder = (): void => {
    getCoworkAgentRuntime().bindExternalAgentCliInstallerForwarder();
  };

  const getAgentManager = () => getCoworkAgentRuntime().getAgentManager();

  const getAgentTeamRunner = () =>
    getCoworkAgentRuntime().getAgentTeamRunner();

  const resolveCoworkAgentEngine = () =>
    getCoworkAgentRuntime().resolveCoworkAgentEngine();

  const resolveAgentRuntimeEngine = (agentId?: string | null) =>
    getCoworkAgentRuntime().resolveAgentRuntimeEngine(agentId);

  const applyExternalAgentConfigSourceForEngine = (engine: Parameters<
    CoworkAgentRuntime['applyExternalAgentConfigSourceForEngine']
  >[0]): void => {
    getCoworkAgentRuntime().applyExternalAgentConfigSourceForEngine(engine);
  };

  const ensureCoworkEngineReady = async (engine: Parameters<
    CoworkAgentRuntime['ensureCoworkEngineReady']
  >[0]) => {
    return await getCoworkAgentRuntime().ensureCoworkEngineReady(engine);
  };

  return {
    bindExternalAgentCliInstallerForwarder,
    getAgentManager,
    getAgentTeamRunner,
    resolveCoworkAgentEngine,
    resolveAgentRuntimeEngine,
    applyExternalAgentConfigSourceForEngine,
    ensureCoworkEngineReady,
  };
}
