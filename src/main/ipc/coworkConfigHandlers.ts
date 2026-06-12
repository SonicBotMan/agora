import { ipcMain } from 'electron';

import {
  CoworkAgentEngine as CoworkAgentEngineValue,
  isClaudeCodePermissionMode,
  isCoworkAgentEngine,
  isDeepSeekTuiPermissionMode,
  isExternalAgentConfigSource,
  isOpenCodePermissionMode,
} from '../../shared/cowork/constants';
import type { CoworkAgentEngine } from '../libs/agentEngine';
import type { SessionDeps } from './sessionDeps';

const ENGINE_NOT_READY_CODE = 'ENGINE_NOT_READY';
const MIN_MEMORY_USER_MEMORIES_MAX_ITEMS = 1;
const MAX_MEMORY_USER_MEMORIES_MAX_ITEMS = 60;

export type CoworkConfigDeps = Pick<
  SessionDeps,
  | 'getCoworkStore'
  | 'getCoworkEngineRouter'
  | 'getIMGatewayManager'
  | 'getSkillManager'
  | 'getHermesConfigSync'
  | 'getHermesEngineManager'
  | 'getOpenClawEngineManager'
  | 'syncOpenClawConfig'
  | 'applyExternalAgentConfigForEngine'
  | 'ensureDefaultIdentity'
  | 'syncMemoryFileOnWorkspaceChange'
  | 'ensureHermesRunningForCowork'
  | 'ensureOpenClawRunningForCowork'
  | 'startHermesIMSessionSyncPolling'
  | 'syncHermesIMSessionsToCowork'
  | 'stopHermesIMSessionSyncPolling'
  | 'isFeishuEngineManagedByAgora'
>;

export function registerCoworkConfigHandlers(deps: CoworkConfigDeps): void {
  const {
    getCoworkStore,
    getCoworkEngineRouter,
    getIMGatewayManager,
    getSkillManager,
    getHermesConfigSync,
    getHermesEngineManager,
    getOpenClawEngineManager,
    syncOpenClawConfig,
    applyExternalAgentConfigForEngine,
    ensureDefaultIdentity,
    syncMemoryFileOnWorkspaceChange,
    ensureHermesRunningForCowork,
    ensureOpenClawRunningForCowork,
    startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork,
    stopHermesIMSessionSyncPolling,
    isFeishuEngineManagedByAgora,
  } = deps;

  ipcMain.handle('cowork:config:get', async () => {
    try {
      const config = getCoworkStore().getConfig();
      return { success: true, config };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get config',
      };
    }
  });

  ipcMain.handle('cowork:config:set', async (_event, config: {
    workingDirectory?: string;
    executionMode?: 'auto' | 'local' | 'sandbox';
    agentEngine?: CoworkAgentEngine;
    claudeCodeConfigSource?: unknown;
    claudeCodePermissionMode?: unknown;
    codexConfigSource?: unknown;
    hermesConfigSource?: unknown;
    opencodeConfigSource?: unknown;
    opencodePermissionMode?: unknown;
    deepseekTuiConfigSource?: unknown;
    deepseekTuiPermissionMode?: unknown;
    memoryEnabled?: boolean;
    memoryImplicitUpdateEnabled?: boolean;
    memoryLlmJudgeEnabled?: boolean;
    memoryGuardLevel?: 'strict' | 'standard' | 'relaxed';
    memoryUserMemoriesMaxItems?: number;
  }) => {
    try {
      const normalizedExecutionMode =
        config.executionMode && String(config.executionMode) === 'container'
          ? 'local'
          : config.executionMode;
      const normalizedAgentEngine = isCoworkAgentEngine(config.agentEngine)
        ? config.agentEngine
        : undefined;
      const normalizedClaudeCodeConfigSource = isExternalAgentConfigSource(config.claudeCodeConfigSource)
        ? config.claudeCodeConfigSource
        : undefined;
      const normalizedClaudeCodePermissionMode = isClaudeCodePermissionMode(config.claudeCodePermissionMode)
        ? config.claudeCodePermissionMode
        : undefined;
      const normalizedCodexConfigSource = isExternalAgentConfigSource(config.codexConfigSource)
        ? config.codexConfigSource
        : undefined;
      const normalizedHermesConfigSource = isExternalAgentConfigSource(config.hermesConfigSource)
        ? config.hermesConfigSource
        : undefined;
      const normalizedOpenCodeConfigSource = isExternalAgentConfigSource(config.opencodeConfigSource)
        ? config.opencodeConfigSource
        : undefined;
      const normalizedOpenCodePermissionMode = isOpenCodePermissionMode(config.opencodePermissionMode)
        ? config.opencodePermissionMode
        : undefined;
      const normalizedDeepSeekTuiConfigSource = isExternalAgentConfigSource(config.deepseekTuiConfigSource)
        ? config.deepseekTuiConfigSource
        : undefined;
      const normalizedDeepSeekTuiPermissionMode = isDeepSeekTuiPermissionMode(config.deepseekTuiPermissionMode)
        ? config.deepseekTuiPermissionMode
        : undefined;
      const normalizedMemoryEnabled = typeof config.memoryEnabled === 'boolean'
        ? config.memoryEnabled
        : undefined;
      const normalizedMemoryImplicitUpdateEnabled = typeof config.memoryImplicitUpdateEnabled === 'boolean'
        ? config.memoryImplicitUpdateEnabled
        : undefined;
      const normalizedMemoryLlmJudgeEnabled = typeof config.memoryLlmJudgeEnabled === 'boolean'
        ? config.memoryLlmJudgeEnabled
        : undefined;
      const normalizedMemoryGuardLevel = config.memoryGuardLevel === 'strict'
        || config.memoryGuardLevel === 'standard'
        || config.memoryGuardLevel === 'relaxed'
        ? config.memoryGuardLevel
        : undefined;
      const normalizedMemoryUserMemoriesMaxItems =
        typeof config.memoryUserMemoriesMaxItems === 'number' && Number.isFinite(config.memoryUserMemoriesMaxItems)
          ? Math.max(
            MIN_MEMORY_USER_MEMORIES_MAX_ITEMS,
            Math.min(MAX_MEMORY_USER_MEMORIES_MAX_ITEMS, Math.floor(config.memoryUserMemoriesMaxItems)),
          )
          : undefined;
      const normalizedConfig: Parameters<ReturnType<typeof getCoworkStore>['setConfig']>[0] = {
        ...config,
        executionMode: normalizedExecutionMode,
        agentEngine: normalizedAgentEngine,
        claudeCodeConfigSource: normalizedClaudeCodeConfigSource,
        claudeCodePermissionMode: normalizedClaudeCodePermissionMode,
        codexConfigSource: normalizedCodexConfigSource,
        hermesConfigSource: normalizedHermesConfigSource,
        opencodeConfigSource: normalizedOpenCodeConfigSource,
        opencodePermissionMode: normalizedOpenCodePermissionMode,
        deepseekTuiConfigSource: normalizedDeepSeekTuiConfigSource,
        deepseekTuiPermissionMode: normalizedDeepSeekTuiPermissionMode,
        memoryEnabled: normalizedMemoryEnabled,
        memoryImplicitUpdateEnabled: normalizedMemoryImplicitUpdateEnabled,
        memoryLlmJudgeEnabled: normalizedMemoryLlmJudgeEnabled,
        memoryGuardLevel: normalizedMemoryGuardLevel,
        memoryUserMemoriesMaxItems: normalizedMemoryUserMemoriesMaxItems,
      };
      const previousConfig = getCoworkStore().getConfig();
      const previousWorkingDir = previousConfig.workingDirectory;
      const nextConfigPreview = { ...previousConfig };
      if (normalizedAgentEngine !== undefined) {
        nextConfigPreview.agentEngine = normalizedAgentEngine;
      }
      if (normalizedClaudeCodeConfigSource !== undefined) {
        nextConfigPreview.claudeCodeConfigSource = normalizedClaudeCodeConfigSource;
      }
      if (normalizedClaudeCodePermissionMode !== undefined) {
        nextConfigPreview.claudeCodePermissionMode = normalizedClaudeCodePermissionMode;
      }
      if (normalizedCodexConfigSource !== undefined) {
        nextConfigPreview.codexConfigSource = normalizedCodexConfigSource;
      }
      if (normalizedHermesConfigSource !== undefined) {
        nextConfigPreview.hermesConfigSource = normalizedHermesConfigSource;
      }
      if (normalizedOpenCodeConfigSource !== undefined) {
        nextConfigPreview.opencodeConfigSource = normalizedOpenCodeConfigSource;
      }
      if (normalizedOpenCodePermissionMode !== undefined) {
        nextConfigPreview.opencodePermissionMode = normalizedOpenCodePermissionMode;
      }
      if (normalizedDeepSeekTuiConfigSource !== undefined) {
        nextConfigPreview.deepseekTuiConfigSource = normalizedDeepSeekTuiConfigSource;
      }
      if (normalizedDeepSeekTuiPermissionMode !== undefined) {
        nextConfigPreview.deepseekTuiPermissionMode = normalizedDeepSeekTuiPermissionMode;
      }

      const shouldApplyExternalAgentConfig =
        (nextConfigPreview.agentEngine === CoworkAgentEngineValue.ClaudeCode
          && (normalizedAgentEngine !== undefined || normalizedClaudeCodeConfigSource !== undefined))
        || (nextConfigPreview.agentEngine === CoworkAgentEngineValue.Codex
          && (normalizedAgentEngine !== undefined || normalizedCodexConfigSource !== undefined))
        || (nextConfigPreview.agentEngine === CoworkAgentEngineValue.OpenCode
          && (normalizedAgentEngine !== undefined || normalizedOpenCodeConfigSource !== undefined))
        || (nextConfigPreview.agentEngine === CoworkAgentEngineValue.DeepSeekTui
          && (normalizedAgentEngine !== undefined || normalizedDeepSeekTuiConfigSource !== undefined));
      if (shouldApplyExternalAgentConfig) {
        const source = nextConfigPreview.agentEngine === CoworkAgentEngineValue.ClaudeCode
          ? nextConfigPreview.claudeCodeConfigSource
          : nextConfigPreview.agentEngine === CoworkAgentEngineValue.Codex
            ? nextConfigPreview.codexConfigSource
            : nextConfigPreview.agentEngine === CoworkAgentEngineValue.OpenCode
              ? nextConfigPreview.opencodeConfigSource
              : nextConfigPreview.deepseekTuiConfigSource;
        applyExternalAgentConfigForEngine(nextConfigPreview.agentEngine, source);
      }
      getCoworkStore().setConfig(normalizedConfig);
      if (normalizedConfig.workingDirectory !== undefined && normalizedConfig.workingDirectory !== previousWorkingDir) {
        getSkillManager().handleWorkingDirectoryChange();
        const syncResult = syncMemoryFileOnWorkspaceChange(previousWorkingDir, normalizedConfig.workingDirectory);
        if (syncResult.error) {
          console.warn('[OpenClaw Memory] Workspace sync failed:', syncResult.error);
        }
        try {
          ensureDefaultIdentity(normalizedConfig.workingDirectory);
        } catch (err) {
          console.warn('[OpenClaw] ensureDefaultIdentity failed (non-fatal):', err);
        }
      }

      const nextConfig = getCoworkStore().getConfig();
      if (normalizedAgentEngine !== undefined && normalizedAgentEngine !== previousConfig.agentEngine) {
        getCoworkEngineRouter().handleEngineConfigChanged(normalizedAgentEngine);
      }
      const switchedToOpenClaw = normalizedAgentEngine === CoworkAgentEngineValue.OpenClaw
        && previousConfig.agentEngine !== CoworkAgentEngineValue.OpenClaw;
      const switchedToHermes = normalizedAgentEngine === CoworkAgentEngineValue.Hermes
        && previousConfig.agentEngine !== CoworkAgentEngineValue.Hermes;
      const switchedAwayFromHermes = normalizedAgentEngine !== undefined
        && previousConfig.agentEngine === CoworkAgentEngineValue.Hermes
        && normalizedAgentEngine !== CoworkAgentEngineValue.Hermes;

      const openClawConfigRelevant = normalizedAgentEngine === CoworkAgentEngineValue.OpenClaw
        || previousConfig.agentEngine === CoworkAgentEngineValue.OpenClaw
        || nextConfig.agentEngine === CoworkAgentEngineValue.OpenClaw;
      const shouldSyncOpenClawConfig = openClawConfigRelevant
        && (normalizedExecutionMode !== undefined
          || normalizedAgentEngine !== undefined
          || (normalizedConfig.workingDirectory !== undefined && normalizedConfig.workingDirectory !== previousWorkingDir));
      if (shouldSyncOpenClawConfig) {
        const syncResult = await syncOpenClawConfig({
          reason: 'cowork-config-change',
          restartGatewayIfRunning: normalizedAgentEngine !== undefined,
        });
        if (!syncResult.success && nextConfig.agentEngine === CoworkAgentEngineValue.OpenClaw) {
          return {
            success: false,
            code: ENGINE_NOT_READY_CODE,
            error: syncResult.error || 'OpenClaw config sync failed.',
            engineStatus: syncResult.status || getOpenClawEngineManager().getStatus(),
          };
        }
      }

      const hermesConfigRelevant = normalizedAgentEngine === CoworkAgentEngineValue.Hermes
        || previousConfig.agentEngine === CoworkAgentEngineValue.Hermes
        || nextConfig.agentEngine === CoworkAgentEngineValue.Hermes;
      const shouldSyncHermesConfig = hermesConfigRelevant
        && (normalizedExecutionMode !== undefined
          || normalizedAgentEngine !== undefined
          || normalizedHermesConfigSource !== undefined
          || (normalizedConfig.workingDirectory !== undefined && normalizedConfig.workingDirectory !== previousWorkingDir));
      if (shouldSyncHermesConfig) {
        const syncResult = getHermesConfigSync().sync('cowork-config-change');
        if (!syncResult.success && nextConfig.agentEngine === CoworkAgentEngineValue.Hermes) {
          return {
            success: false,
            code: ENGINE_NOT_READY_CODE,
            error: syncResult.error || 'Hermes Agent config sync failed.',
            engineStatus: syncResult.status || getHermesEngineManager().getStatus(),
          };
        }
      }

      if (switchedToOpenClaw) {
        void ensureOpenClawRunningForCowork().catch((error) => {
          console.error('[OpenClaw] Failed to auto-start gateway after engine switch:', error);
        });
      }
      if (switchedToHermes) {
        void ensureHermesRunningForCowork()
          .then((status) => {
            if (status.phase === 'running') {
              startHermesIMSessionSyncPolling();
              void syncHermesIMSessionsToCowork('engine-switch');
            }
          })
          .catch((error) => {
            console.error('[Hermes] Failed to auto-start gateway after engine switch:', error);
          });
      }
      if (switchedAwayFromHermes) {
        stopHermesIMSessionSyncPolling();
        if (isFeishuEngineManagedByAgora('hermes')) {
          void getHermesEngineManager().stopGateway().catch((error) => {
            console.error('[Hermes] Failed to stop gateway after engine switch:', error);
          });
        }
      }
      if (normalizedAgentEngine !== undefined && normalizedAgentEngine !== previousConfig.agentEngine) {
        void getIMGatewayManager().startAllEnabled().catch((error) => {
          console.error('[IM] Failed to reconcile enabled gateways after engine switch:', error);
        });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set config',
      };
    }
  });
}
