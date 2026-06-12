import { ipcMain } from 'electron';

import { CoworkIpcChannel, ExternalAgentConfigSource } from '../../shared/cowork/constants';
import type { ExternalAgentProviderInput } from '../libs/externalAgentProviderStore';
import type { SessionDeps } from './sessionDeps';

export type CoworkAgentProviderDeps = Pick<
  SessionDeps,
  | 'getCoworkStore'
  | 'getExternalAgentCliInstaller'
  | 'getExternalAgentProviderStore'
  | 'getStore'
  | 'getHermesConfigSync'
  | 'getHermesEngineManager'
  | 'getOpenClawEngineManager'
  | 'syncOpenClawConfig'
  | 'syncOpenCodeGlobalConfigFromAgoraModel'
  | 'syncDeepSeekTuiGlobalConfigFromAgoraModel'
  | 'importLocalAgentConfigToModelSettings'
  | 'isExternalAgentProviderAppType'
  | 'bindExternalAgentCliInstallerForwarder'
  | 'bindHermesStatusForwarder'
  | 'bindOpenClawStatusForwarder'
  | 'getMergedExternalAgentEnvironmentSnapshot'
  | 'refreshEndpointsTestMode'
>;

export function registerCoworkAgentProviderHandlers(deps: CoworkAgentProviderDeps): void {
  const {
    getCoworkStore,
    getExternalAgentCliInstaller,
    getExternalAgentProviderStore,
    getStore,
    getHermesConfigSync,
    getHermesEngineManager,
    getOpenClawEngineManager,
    syncOpenClawConfig,
    syncOpenCodeGlobalConfigFromAgoraModel,
    syncDeepSeekTuiGlobalConfigFromAgoraModel,
    importLocalAgentConfigToModelSettings,
    isExternalAgentProviderAppType,
    bindExternalAgentCliInstallerForwarder,
    bindHermesStatusForwarder,
    bindOpenClawStatusForwarder,
    getMergedExternalAgentEnvironmentSnapshot,
    refreshEndpointsTestMode,
  } = deps;

  ipcMain.handle(CoworkIpcChannel.AgentCliInstall, async (_event, input: { appType?: unknown }) => {
    try {
      if (!isExternalAgentProviderAppType(input?.appType)) {
        return { success: false, error: 'Invalid agent CLI app type.' };
      }
      bindExternalAgentCliInstallerForwarder();
      const result = await getExternalAgentCliInstaller().install(input.appType);
      if (result.success && input.appType === 'hermes') {
        getCoworkStore().setConfig({ hermesConfigSource: ExternalAgentConfigSource.AgoraModel });
        getHermesConfigSync().sync('agent-cli-install');
        bindHermesStatusForwarder();
        await getHermesEngineManager().ensureReady();
      }
      if (result.success && input.appType === 'openclaw') {
        getCoworkStore().setConfig({ openclawConfigSource: ExternalAgentConfigSource.AgoraModel });
        bindOpenClawStatusForwarder();
        await getOpenClawEngineManager().ensureReady();
      }
      return {
        ...result,
        snapshot: getMergedExternalAgentEnvironmentSnapshot(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install agent CLI',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentConfigImportLocalToModelSettings, async (_event, input: { appType?: unknown }) => {
    try {
      if (!isExternalAgentProviderAppType(input?.appType)) {
        return { success: false, error: 'Invalid agent CLI app type.' };
      }
      if (input.appType === 'openclaw') {
        return {
          success: false,
          imported: false,
          error: 'OpenClaw local config import is not available yet. Use Local CLI Config to keep your existing OpenClaw setup.',
        };
      }
      const store = getStore();
      const result = importLocalAgentConfigToModelSettings(store, input.appType);
      if (result.imported) {
        refreshEndpointsTestMode(store);
        const syncResult = await syncOpenClawConfig({
          reason: 'agent-local-config-import',
          restartGatewayIfRunning: false,
        });
        if (!syncResult.success) {
          console.warn('[ExternalAgentConfigSync] OpenClaw config sync after model import failed:', syncResult.error);
        }
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import local agent config to model settings',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentConfigSyncOpenClawGlobal, async () => {
    try {
      getCoworkStore().setConfig({ openclawConfigSource: ExternalAgentConfigSource.AgoraModel });
      const syncResult = await syncOpenClawConfig({
        reason: 'manual-openclaw-model-sync',
        restartGatewayIfRunning: false,
      });
      return {
        success: syncResult.success,
        changed: syncResult.changed,
        status: syncResult.status ?? getOpenClawEngineManager().getStatus(),
        error: syncResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync OpenClaw config',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentConfigSyncOpenCodeGlobal, async () => {
    try {
      syncOpenCodeGlobalConfigFromAgoraModel();
      const list = getExternalAgentProviderStore().listProviders('opencode');
      return { success: true, ...list };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync OpenCode config',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentConfigSyncDeepSeekTuiGlobal, async () => {
    try {
      syncDeepSeekTuiGlobalConfigFromAgoraModel();
      const list = getExternalAgentProviderStore().listProviders('deepseek_tui');
      return { success: true, ...list };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync DeepSeek-TUI config',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentProvidersList, async (_event, input: { appType?: unknown }) => {
    try {
      if (!isExternalAgentProviderAppType(input?.appType)) {
        return { success: false, error: 'Invalid agent provider app type.' };
      }
      const result = getExternalAgentProviderStore().listProviders(input.appType);
      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list agent providers',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentProvidersSave, async (_event, input: ExternalAgentProviderInput) => {
    try {
      if (!isExternalAgentProviderAppType(input?.appType)) {
        return { success: false, error: 'Invalid agent provider app type.' };
      }
      const provider = getExternalAgentProviderStore().saveProvider(input);
      const list = getExternalAgentProviderStore().listProviders(input.appType);
      return { success: true, provider, ...list };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save agent provider',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentProvidersDelete, async (_event, input: { appType?: unknown; id?: unknown }) => {
    try {
      if (!isExternalAgentProviderAppType(input?.appType) || typeof input?.id !== 'string') {
        return { success: false, error: 'Invalid agent provider delete request.' };
      }
      getExternalAgentProviderStore().deleteProvider(input.appType, input.id);
      const list = getExternalAgentProviderStore().listProviders(input.appType);
      return { success: true, ...list };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete agent provider',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentProvidersSetCurrent, async (_event, input: { appType?: unknown; id?: unknown }) => {
    try {
      if (!isExternalAgentProviderAppType(input?.appType) || typeof input?.id !== 'string') {
        return { success: false, error: 'Invalid agent provider switch request.' };
      }
      const provider = getExternalAgentProviderStore().setCurrentProvider(input.appType, input.id);
      const list = getExternalAgentProviderStore().listProviders(input.appType);
      return { success: true, provider, ...list };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch agent provider',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.AgentProvidersImportLive, async (_event, input: { appType?: unknown }) => {
    try {
      if (!isExternalAgentProviderAppType(input?.appType)) {
        return { success: false, error: 'Invalid agent provider app type.' };
      }
      const provider = getExternalAgentProviderStore().importLiveProvider(input.appType);
      const list = getExternalAgentProviderStore().listProviders(input.appType);
      return { success: true, provider, ...list };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import local agent provider',
      };
    }
  });
}
