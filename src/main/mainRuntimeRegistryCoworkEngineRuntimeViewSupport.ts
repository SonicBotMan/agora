import type { CoworkEngineRuntime } from './coworkEngineRuntime';
import type { MainRuntimeRegistryCoworkEngineRuntimeSupport } from './mainRuntimeRegistryCoworkEngineRuntimeContract';

export function createMainRuntimeRegistryCoworkEngineRuntimeView(
  getCoworkEngineRuntime: () => CoworkEngineRuntime,
  peekCoworkEngineRuntime: () => CoworkEngineRuntime | null,
): MainRuntimeRegistryCoworkEngineRuntimeSupport {
  const peekOpenClawEngineManager = () =>
    peekCoworkEngineRuntime()?.peekOpenClawEngineManager() ?? null;

  const peekHermesEngineManager = () =>
    peekCoworkEngineRuntime()?.peekHermesEngineManager() ?? null;

  const getPendingTokenRefresh = () =>
    peekCoworkEngineRuntime()?.getPendingTokenRefresh() ?? null;

  const setPendingTokenRefresh = (
    promise: Promise<string | null> | null,
  ): void => {
    if (!peekCoworkEngineRuntime() && !promise) {
      return;
    }
    getCoworkEngineRuntime().setPendingTokenRefresh(promise);
  };

  const getOpenClawEngineManager = () =>
    getCoworkEngineRuntime().getOpenClawEngineManager();

  const getHermesEngineManager = () =>
    getCoworkEngineRuntime().getHermesEngineManager();

  const bindOpenClawStatusForwarder = (): void => {
    getCoworkEngineRuntime().bindOpenClawStatusForwarder();
  };

  const bindHermesStatusForwarder = (): void => {
    getCoworkEngineRuntime().bindHermesStatusForwarder();
  };

  const getHermesConfigSync = () =>
    getCoworkEngineRuntime().getHermesConfigSync();

  const bootstrapHermesEngine = async (
    options: Parameters<CoworkEngineRuntime['bootstrapHermesEngine']>[0] = {},
  ) => {
    return await getCoworkEngineRuntime().bootstrapHermesEngine(options);
  };

  const ensureOpenClawRunningForCowork = async () =>
    await getCoworkEngineRuntime().ensureOpenClawRunningForCowork();

  const ensureHermesRunningForCowork = async () =>
    await getCoworkEngineRuntime().ensureHermesRunningForCowork();

  const detectLocalOpenClawFeishu = () =>
    getCoworkEngineRuntime().detectLocalOpenClawFeishu();

  const hasLocalOpenClawFeishuConfigured = (): boolean =>
    getCoworkEngineRuntime().hasLocalOpenClawFeishuConfigured();

  const syncHermesIMSessionsToCowork = async (
    reason: string,
  ): Promise<void> =>
    await getCoworkEngineRuntime().syncHermesIMSessionsToCowork(reason);

  const startHermesIMSessionSyncPolling = (): void => {
    getCoworkEngineRuntime().startHermesIMSessionSyncPolling();
  };

  const stopHermesIMSessionSyncPolling = (): void => {
    getCoworkEngineRuntime().stopHermesIMSessionSyncPolling();
  };

  const getOpenClawConfigSync = () =>
    getCoworkEngineRuntime().getOpenClawConfigSync();

  const syncOpenClawConfig = async (
    options: Parameters<CoworkEngineRuntime['syncOpenClawConfig']>[0] = {
      reason: 'unknown',
    },
  ) => {
    return await getCoworkEngineRuntime().syncOpenClawConfig(options);
  };

  return {
    peekOpenClawEngineManager,
    peekHermesEngineManager,
    getPendingTokenRefresh,
    setPendingTokenRefresh,
    getOpenClawEngineManager,
    getHermesEngineManager,
    bindOpenClawStatusForwarder,
    bindHermesStatusForwarder,
    getHermesConfigSync,
    bootstrapHermesEngine,
    ensureOpenClawRunningForCowork,
    ensureHermesRunningForCowork,
    detectLocalOpenClawFeishu,
    hasLocalOpenClawFeishuConfigured,
    syncHermesIMSessionsToCowork,
    startHermesIMSessionSyncPolling,
    stopHermesIMSessionSyncPolling,
    getOpenClawConfigSync,
    syncOpenClawConfig,
  };
}
