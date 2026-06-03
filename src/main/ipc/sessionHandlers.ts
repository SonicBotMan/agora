/**
 * Agora — Session / Cowork IPC Handlers
 *
 * Extracted from main.ts (lines ~3557–4927).
 * Session lifecycle, engine routing, config, memory, bootstrap,
 * agent CLI, runtime metrics, studio assets, clipboard, and permission handlers.
 * Largest handler group (~55 handlers).
 */

import { app, BrowserWindow, clipboard, dialog, ipcMain, IpcMainInvokeEvent, nativeImage, WebContents } from 'electron';
import fs from 'fs';
import path from 'path';

import { CoworkAgentEngine as CoworkAgentEngineValue, CoworkIpcChannel, CoworkSessionKind, ExternalAgentConfigSource, isClaudeCodePermissionMode, isCoworkAgentEngine, isDeepSeekTuiPermissionMode, isExternalAgentConfigSource, isOpenCodePermissionMode, RuntimeCallSource, RuntimeCallStatus } from '../../shared/cowork/constants';
import type { RuntimeMetricsFilters } from '../../shared/cowork/runtimeMetrics';
import type { CoworkSessionRuntimeSnapshot } from '../../shared/cowork/runtimeSnapshot';
import type { CoworkAgentEngine } from '../libs/agentEngine';
import { buildScheduledTaskEnginePrompt } from '../../scheduledTask/enginePrompt';
import type { CoworkMessage, CoworkSession } from '../coworkStore';
import type { ExternalAgentProviderAppType, ExternalAgentProviderInput } from '../libs/externalAgentProviderStore';

// ── Constants (moved from main.ts) ────────────────────────────────────────
const INVALID_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]/g;
const ENGINE_NOT_READY_CODE = 'ENGINE_NOT_READY';
const MIN_MEMORY_USER_MEMORIES_MAX_ITEMS = 1;
const MAX_MEMORY_USER_MEMORIES_MAX_ITEMS = 60;

const sanitizeExportFileName = (value: string): string => {
  const sanitized = value.replace(INVALID_FILE_NAME_PATTERN, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || 'cowork-session';
};

const ensurePngFileName = (name: string): string => {
  return name.endsWith('.png') ? name : `${name}.png`;
};

const getDefaultExportImageName = (defaultFileName?: string): string => {
  const normalized = typeof defaultFileName === 'string' && defaultFileName.trim()
    ? defaultFileName.trim()
    : `cowork-session-${Date.now()}`;
  return ensurePngFileName(sanitizeExportFileName(normalized));
};

type CaptureRect = { x: number; y: number; width: number; height: number };

const normalizeCaptureRect = (rect?: Partial<CaptureRect> | null): CaptureRect | null => {
  if (!rect) return null;
  const normalized = {
    x: Math.max(0, Math.round(typeof rect.x === 'number' ? rect.x : 0)),
    y: Math.max(0, Math.round(typeof rect.y === 'number' ? rect.y : 0)),
    width: Math.max(0, Math.round(typeof rect.width === 'number' ? rect.width : 0)),
    height: Math.max(0, Math.round(typeof rect.height === 'number' ? rect.height : 0)),
  };
  return normalized.width > 0 && normalized.height > 0 ? normalized : null;
};

const normalizeRuntimeMetricsFilters = (input: unknown): RuntimeMetricsFilters => {
  const filters: RuntimeMetricsFilters = {};
  if (!input || typeof input !== 'object') return filters;
  const record = input as Record<string, unknown>;
  if (typeof record.providerKey === 'string' && record.providerKey.trim()) filters.providerKey = record.providerKey.trim();
  if (typeof record.status === 'string') {
    if ((Object.values(RuntimeCallStatus) as string[]).includes(record.status)) {
      filters.status = record.status as RuntimeCallStatus;
    }
  }
  if (typeof record.source === 'string') {
    if (Object.values(RuntimeCallSource).includes(record.source as RuntimeCallSource)) {
      filters.source = record.source as RuntimeCallSource;
    }
  }
  if (typeof record.sessionId === 'string' && record.sessionId.trim()) filters.sessionId = record.sessionId.trim();
  const limit = Number(record.limit);
  const offset = Number(record.offset);
  if (Number.isFinite(limit)) filters.limit = limit;
  if (Number.isFinite(offset)) filters.offset = offset;
  return filters;
};

// ── Module-level state (migrated from main.ts) ───────────────────────────
let memoryMigrationDone = false;

// ── Dependency Interface ──────────────────────────────────────────────────

export interface SessionDeps {
  // Store
  getCoworkStore: () => import('../coworkStore').CoworkStore;
  getCoworkEngineRouter: () => import('../libs/agentEngine').CoworkEngineRouter;
  getCoworkFileActivityTracker: () => import('../coworkFileActivityTracker').CoworkFileActivityTracker;
  getRuntimeTelemetryStore: () => import('../runtimeTelemetryStore').RuntimeTelemetryStore;
  getIMGatewayManager: () => import('../im').IMGatewayManager;
  getExternalAgentCliInstaller: () => import('../libs/externalAgentCliInstaller').ExternalAgentCliInstaller;
  getExternalAgentProviderStore: () => import('../libs/externalAgentProviderStore').ExternalAgentProviderStore;
  getAgentTeamRunner: () => { run: (opts: { teamId: string; parentSessionId: string; prompt: string; runtimeSource: string }) => Promise<void> };
  getStore: () => import('../sqliteStore').SqliteStore;
  getSkillManager: () => import('../skillManager').SkillManager;

  // Agent engine helpers
  resolveCoworkAgentEngine: () => CoworkAgentEngine;
  resolveAgentRuntimeEngine: (agentId?: string | null) => CoworkAgentEngine;
  ensureCoworkEngineReady: (engine: CoworkAgentEngine) => Promise<{ success: boolean; engineStatus?: { message?: string }; error?: string }>;
  getEngineNotReadyResponse: (status: { message?: string }) => { success: boolean; [key: string]: unknown };
  mergeCoworkSystemPrompt: (engine: CoworkAgentEngine, systemPrompt?: string) => string | undefined;
  applyExternalAgentConfigSourceForEngine: (engine: CoworkAgentEngine) => void;
  applyExternalAgentConfigForEngine: (engine: CoworkAgentEngine, source: unknown) => void;
  resolveSessionRuntimeSnapshot: (engine: CoworkAgentEngine) => CoworkSessionRuntimeSnapshot;
  prepareRuntimeSnapshotForTurn: (snapshot?: CoworkSessionRuntimeSnapshot | null) => void;
  resolveTaskWorkingDirectory: (workspaceRoot: string) => string;

  // External agent config sync
  getHermesConfigSync: () => import('../libs/hermesConfigSync').HermesConfigSync;
  getHermesEngineManager: () => import('../libs/hermesEngineManager').HermesEngineManager;
  getOpenClawEngineManager: () => import('../libs/openclawEngineManager').OpenClawEngineManager;
  syncOpenClawConfig: (opts: { reason: string; restartGatewayIfRunning?: boolean }) => Promise<{ success: boolean; changed?: boolean; status?: { message?: string; phase?: string }; error?: string }>;
  syncOpenCodeGlobalConfigFromAgoraModel: () => void;
  syncDeepSeekTuiGlobalConfigFromAgoraModel: () => void;
  importLocalAgentConfigToModelSettings: (store: import('../sqliteStore').SqliteStore, appType: ExternalAgentProviderAppType) => { success: boolean; imported: boolean; error?: string };
  isExternalAgentProviderAppType: (value: unknown) => value is ExternalAgentProviderAppType;
  bindExternalAgentCliInstallerForwarder: () => void;
  bindHermesStatusForwarder: () => void;
  bindOpenClawStatusForwarder: () => void;
  getMergedExternalAgentEnvironmentSnapshot: () => Record<string, unknown>;

  // Memory file helpers (re-exported from lib)
  resolveMemoryFilePath: (workingDirectory: string) => string;
  readMemoryEntries: (filePath: string) => Array<{ id: string; text: string }>;
  searchMemoryEntries: (filePath: string, query: string) => Array<{ id: string; text: string }>;
  addMemoryEntry: (filePath: string, text: string) => { id: string; text: string };
  updateMemoryEntry: (filePath: string, id: string, text: string) => { id: string; text: string } | null;
  deleteMemoryEntry: (filePath: string, id: string) => boolean;
  migrateSqliteToMemoryMd: (filePath: string, opts: { isMigrationDone: () => boolean; markMigrationDone: () => void; getActiveMemoryTexts: () => string[] }) => void;
  syncMemoryFileOnWorkspaceChange: (oldDir: string | undefined, newDir: string) => { error?: string };
  ensureDefaultIdentity: (workingDirectory: string) => void;
  readBootstrapFile: (workingDirectory: string, filename: string) => string;
  writeBootstrapFile: (workingDirectory: string, filename: string, content: string) => void;

  // Broadcast helpers
  broadcastCoworkMessage: (sessionId: string, message: CoworkMessage) => void;
  broadcastCoworkError: (sessionId: string, error: string) => void;

  // Hermes IM session sync
  ensureHermesRunningForCowork: () => Promise<{ phase: string; message?: string }>;
  ensureOpenClawRunningForCowork: () => Promise<void>;
  startHermesIMSessionSyncPolling: () => void;
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
  stopHermesIMSessionSyncPolling: () => void;
  isFeishuEngineManagedByAgora: (key: string) => boolean;

  // Config normalization helpers
  refreshEndpointsTestMode: (store: import('../sqliteStore').SqliteStore) => void;
}

// ── Handler Registration ──────────────────────────────────────────────────

export function registerSessionHandlers(deps: SessionDeps): void {
  const {
    getCoworkStore,
    getCoworkEngineRouter,
    getCoworkFileActivityTracker,
    getRuntimeTelemetryStore,
    getIMGatewayManager,
    getExternalAgentCliInstaller,
    getExternalAgentProviderStore,
    getAgentTeamRunner,
    getStore,
    getSkillManager,
    resolveCoworkAgentEngine,
    resolveAgentRuntimeEngine,
    ensureCoworkEngineReady,
    getEngineNotReadyResponse,
    mergeCoworkSystemPrompt,
    applyExternalAgentConfigSourceForEngine,
    applyExternalAgentConfigForEngine,
    resolveSessionRuntimeSnapshot,
    prepareRuntimeSnapshotForTurn,
    resolveTaskWorkingDirectory,
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
    resolveMemoryFilePath,
    readMemoryEntries,
    searchMemoryEntries,
    addMemoryEntry,
    updateMemoryEntry,
    deleteMemoryEntry,
    migrateSqliteToMemoryMd,
    syncMemoryFileOnWorkspaceChange,
    ensureDefaultIdentity,
    readBootstrapFile,
    writeBootstrapFile,
    broadcastCoworkMessage,
    broadcastCoworkError,
    ensureHermesRunningForCowork,
    ensureOpenClawRunningForCowork,
    startHermesIMSessionSyncPolling,
    syncHermesIMSessionsToCowork,
    stopHermesIMSessionSyncPolling,
    isFeishuEngineManagedByAgora,
    refreshEndpointsTestMode,
  } = deps;

  // =====================================================================
  //  SESSION CRUD / LIFECYCLE
  // =====================================================================

  // ── cowork:session:start ─────────────────────────────────────────────
  ipcMain.handle('cowork:session:start', async (_event, options: {
    prompt: string;
    cwd?: string;
    systemPrompt?: string;
    title?: string;
    activeSkillIds?: string[];
    imageAttachments?: Array<{ name: string; mimeType: string; base64Data: string }>;
    agentId?: string;
    teamId?: string;
  }) => {
    try {
      const coworkStoreInstance = getCoworkStore();
      const config = coworkStoreInstance.getConfig();
      const targetAgentId = options.agentId || 'main';
      const activeEngine = options.teamId
        ? resolveCoworkAgentEngine()
        : resolveAgentRuntimeEngine(targetAgentId);
      const ready = await ensureCoworkEngineReady(activeEngine);
      if (!ready.success) {
        if (ready.engineStatus) {
          return getEngineNotReadyResponse(ready.engineStatus);
        }
        return { success: false, error: ready.error || 'Agent engine is not ready.' };
      }
      const systemPrompt = mergeCoworkSystemPrompt(
        activeEngine,
        options.systemPrompt ?? config.systemPrompt,
      );
      const selectedWorkspaceRoot = (options.cwd || config.workingDirectory || '').trim();

      if (!selectedWorkspaceRoot) {
        return {
          success: false,
          error: 'Please select a task folder before submitting.',
        };
      }
      applyExternalAgentConfigSourceForEngine(activeEngine);
      const runtimeSnapshot = resolveSessionRuntimeSnapshot(activeEngine);
      prepareRuntimeSnapshotForTurn(runtimeSnapshot);

      // Generate title from first line of prompt
      const fallbackTitle = options.prompt.split('\n')[0].slice(0, 50) || 'New Session';
      const title = options.title?.trim() || fallbackTitle;
      const taskWorkingDirectory = resolveTaskWorkingDirectory(selectedWorkspaceRoot);

      const session = coworkStoreInstance.createSession(
        title,
        taskWorkingDirectory,
        systemPrompt,
        config.executionMode || 'local',
        options.activeSkillIds || [],
        options.teamId ? `team:${options.teamId}` : targetAgentId,
        options.teamId
          ? {
            sessionKind: CoworkSessionKind.TeamParent,
            teamId: options.teamId,
            runtimeSnapshot,
          }
          : { runtimeSnapshot },
      );

      // Update session status to 'running' before starting async task
      coworkStoreInstance.updateSession(session.id, { status: 'running' });

      // Build metadata, include imageAttachments if present
      const messageMetadata: Record<string, unknown> = {};
      if (options.activeSkillIds?.length) {
        messageMetadata.skillIds = options.activeSkillIds;
      }
      if (options.imageAttachments?.length) {
        messageMetadata.imageAttachments = options.imageAttachments;
      }
      coworkStoreInstance.addMessage(session.id, {
        type: 'user',
        content: options.prompt,
        metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
      });

      if (options.teamId) {
        getCoworkFileActivityTracker().startSession(session.id, taskWorkingDirectory);
        getAgentTeamRunner().run({
          teamId: options.teamId,
          parentSessionId: session.id,
          prompt: options.prompt,
          runtimeSource: RuntimeCallSource.Chat,
        }).catch(error => {
          console.error('[AgentTeamRunner] team session failed:', error);
          const existing = coworkStoreInstance.getSession(session.id);
          if (existing?.status === 'error') return;
          const errorMessage = error instanceof Error ? error.message : String(error);
          broadcastCoworkError(session.id, errorMessage);
        });
        const sessionWithMessages = coworkStoreInstance.getSession(session.id) || {
          ...session,
          status: 'running' as const,
        };
        return { success: true, session: sessionWithMessages };
      }

      // Start the session asynchronously (skip initial user message since we already added it)
      const runtime = getCoworkEngineRouter();
      getCoworkFileActivityTracker().startSession(session.id, taskWorkingDirectory);
      runtime.startSession(session.id, options.prompt, {
        skipInitialUserMessage: true,
        systemPrompt,
        skillIds: options.activeSkillIds,
        workspaceRoot: selectedWorkspaceRoot,
        confirmationMode: 'modal',
        imageAttachments: options.imageAttachments,
        agentId: targetAgentId,
        agentEngine: activeEngine,
        runtimeSnapshot,
      }).catch(error => {
        console.error('Cowork session error:', error);
        const existing = coworkStoreInstance.getSession(session.id);
        if (existing?.status === 'error') return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((win) => {
          if (win.isDestroyed()) return;
          win.webContents.send('cowork:stream:error', { sessionId: session.id, error: errorMessage });
        });
      });

      const sessionWithMessages = coworkStoreInstance.getSession(session.id) || {
        ...session,
        status: 'running' as const,
      };
      return { success: true, session: sessionWithMessages };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start session',
      };
    }
  });

  // ── cowork:session:continue ──────────────────────────────────────────
  ipcMain.handle('cowork:session:continue', async (_event, options: {
    sessionId: string;
    prompt: string;
    systemPrompt?: string;
    activeSkillIds?: string[];
    imageAttachments?: Array<{ name: string; mimeType: string; base64Data: string }>;
  }) => {
    try {
      const existingSession = getCoworkStore().getSession(options.sessionId);
      const inferredEngine = existingSession?.teamId
        ? resolveCoworkAgentEngine()
        : resolveAgentRuntimeEngine(existingSession?.agentId || 'main');
      const runtimeSnapshot = existingSession?.runtimeSnapshot
        ?? resolveSessionRuntimeSnapshot(inferredEngine);
      if (existingSession && !existingSession.runtimeSnapshot) {
        getCoworkStore().updateSession(options.sessionId, { runtimeSnapshot });
      }
      const activeEngine = runtimeSnapshot.agentEngine;
      const ready = await ensureCoworkEngineReady(activeEngine);
      if (!ready.success) {
        if (ready.engineStatus) {
          return getEngineNotReadyResponse(ready.engineStatus);
        }
        return { success: false, error: ready.error || 'Agent engine is not ready.' };
      }
      applyExternalAgentConfigSourceForEngine(activeEngine);
      prepareRuntimeSnapshotForTurn(runtimeSnapshot);

      const runtime = getCoworkEngineRouter();
      if (existingSession?.cwd) {
        getCoworkFileActivityTracker().startSession(options.sessionId, existingSession.cwd);
      }
      if (existingSession?.teamId) {
        const userMessage = getCoworkStore().addMessage(options.sessionId, {
          type: 'user',
          content: options.prompt,
          metadata: options.activeSkillIds?.length ? { skillIds: options.activeSkillIds } : undefined,
        });
        broadcastCoworkMessage(options.sessionId, userMessage);
        getCoworkStore().updateSession(options.sessionId, { status: 'running' });
        getAgentTeamRunner().run({
          teamId: existingSession.teamId,
          parentSessionId: options.sessionId,
          prompt: options.prompt,
          runtimeSource: RuntimeCallSource.Chat,
        }).catch(error => {
          console.error('[AgentTeamRunner] team continue failed:', error);
          const existing = getCoworkStore().getSession(options.sessionId);
          if (existing?.status === 'error') return;
          const errorMessage = error instanceof Error ? error.message : String(error);
          broadcastCoworkError(options.sessionId, errorMessage);
        });
        const session = getCoworkStore().getSession(options.sessionId);
        return { success: true, session };
      }

      runtime.continueSession(options.sessionId, options.prompt, {
        systemPrompt: mergeCoworkSystemPrompt(
          activeEngine,
          options.systemPrompt ?? existingSession?.systemPrompt,
        ),
        skillIds: options.activeSkillIds,
        imageAttachments: options.imageAttachments,
        agentId: existingSession?.agentId || 'main',
        agentEngine: activeEngine,
        runtimeSnapshot,
      }).catch(error => {
        console.error('Cowork continue error:', error);
        const existing = getCoworkStore().getSession(options.sessionId);
        if (existing?.status === 'error') return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((win) => {
          if (win.isDestroyed()) return;
          win.webContents.send('cowork:stream:error', { sessionId: options.sessionId, error: errorMessage });
        });
      });

      const session = getCoworkStore().getSession(options.sessionId);
      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to continue session',
      };
    }
  });

  // ── cowork:session:stop ───────────────────────────────────────────────
  ipcMain.handle('cowork:session:stop', async (_event, sessionId: string) => {
    try {
      const runtime = getCoworkEngineRouter();
      runtime.stopSession(sessionId);
      getCoworkFileActivityTracker().stopSession(sessionId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop session',
      };
    }
  });

  // ── cowork:session:delete ─────────────────────────────────────────────
  ipcMain.handle('cowork:session:delete', async (_event, sessionId: string) => {
    try {
      getCoworkEngineRouter().stopSession(sessionId);
      getCoworkFileActivityTracker().stopSession(sessionId);
      const coworkStoreInstance = getCoworkStore();
      getRuntimeTelemetryStore().deleteBySession(sessionId);
      coworkStoreInstance.deleteSession(sessionId);
      // Clean up IM session mapping so that new channel messages
      // create a fresh session instead of referencing a deleted one.
      try {
        getIMGatewayManager()?.getIMStore()?.deleteSessionMappingByCoworkSessionId(sessionId);
      } catch {
        // IM store may not be initialised yet; safe to ignore.
      }
      // Notify runtime to purge in-memory caches for this session
      try {
        getCoworkEngineRouter().onSessionDeleted(sessionId);
      } catch {
        // Router may not be initialised yet; safe to ignore.
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete session',
      };
    }
  });

  // ── cowork:session:deleteBatch ────────────────────────────────────────
  ipcMain.handle('cowork:session:deleteBatch', async (_event, sessionIds: string[]) => {
    try {
      const runtime = getCoworkEngineRouter();
      sessionIds.forEach((sessionId) => {
        runtime.stopSession(sessionId);
        getCoworkFileActivityTracker().stopSession(sessionId);
      });
      const coworkStoreInstance = getCoworkStore();
      getRuntimeTelemetryStore().deleteBySessions(sessionIds);
      coworkStoreInstance.deleteSessions(sessionIds);
      const router = getCoworkEngineRouter();
      for (const sessionId of sessionIds) {
        try {
          getIMGatewayManager()?.getIMStore()?.deleteSessionMappingByCoworkSessionId(sessionId);
        } catch {
          // IM store may not be initialised yet; safe to ignore.
        }
        try {
          router.onSessionDeleted(sessionId);
        } catch {
          // Router may not be initialised yet; safe to ignore.
        }
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch delete sessions',
      };
    }
  });

  // ── cowork:session:pin ────────────────────────────────────────────────
  ipcMain.handle('cowork:session:pin', async (_event, options: { sessionId: string; pinned: boolean }) => {
    try {
      const coworkStoreInstance = getCoworkStore();
      coworkStoreInstance.setSessionPinned(options.sessionId, options.pinned);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update session pin',
      };
    }
  });

  // ── cowork:session:rename ─────────────────────────────────────────────
  ipcMain.handle('cowork:session:rename', async (_event, options: { sessionId: string; title: string }) => {
    try {
      const title = options.title.trim();
      if (!title) {
        return { success: false, error: 'Title is required' };
      }
      const coworkStoreInstance = getCoworkStore();
      coworkStoreInstance.updateSession(options.sessionId, { title });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename session',
      };
    }
  });

  // ── cowork:session:get ────────────────────────────────────────────────
  ipcMain.handle('cowork:session:get', async (_event, sessionId: string) => {
    try {
      const session = getCoworkStore().getSession(sessionId);
      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
      };
    }
  });

  // ── cowork:session:remoteManaged ──────────────────────────────────────
  ipcMain.handle('cowork:session:remoteManaged', async (_event, sessionId: string) => {
    try {
      const mapping = getIMGatewayManager()?.getIMStore()?.getSessionMappingByCoworkSessionId(sessionId);
      return { success: true, remoteManaged: !!mapping };
    } catch (error) {
      return {
        success: false,
        remoteManaged: false,
        error: error instanceof Error ? error.message : 'Failed to check remote managed session',
      };
    }
  });

  // ── cowork:session:list ───────────────────────────────────────────────
  ipcMain.handle('cowork:session:list', async (_event, agentId?: string) => {
    try {
      const sessions = getCoworkStore().listSessions(agentId);
      return { success: true, sessions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list sessions',
      };
    }
  });

  // =====================================================================
  //  SESSION EXPORT / CAPTURE
  // =====================================================================

  // ── cowork:session:exportResultImage ──────────────────────────────────
  ipcMain.handle('cowork:session:exportResultImage', async (
    event,
    options: {
      rect: { x: number; y: number; width: number; height: number };
      defaultFileName?: string;
    }
  ) => {
    try {
      const { rect, defaultFileName } = options || {};
      const captureRect = normalizeCaptureRect(rect);
      if (!captureRect) {
        return { success: false, error: 'Capture rect is required' };
      }

      const image = await event.sender.capturePage(captureRect);
      return savePngWithDialog(event.sender, image.toPNG(), defaultFileName);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export session image',
      };
    }
  });

  // ── cowork:session:captureImageChunk ──────────────────────────────────
  ipcMain.handle('cowork:session:captureImageChunk', async (
    event,
    options: {
      rect: { x: number; y: number; width: number; height: number };
    }
  ) => {
    try {
      const captureRect = normalizeCaptureRect(options?.rect);
      if (!captureRect) {
        return { success: false, error: 'Capture rect is required' };
      }

      const image = await event.sender.capturePage(captureRect);
      const pngBuffer = image.toPNG();

      return {
        success: true,
        width: captureRect.width,
        height: captureRect.height,
        pngBase64: pngBuffer.toString('base64'),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture session image chunk',
      };
    }
  });

  // ── cowork:session:saveResultImage ────────────────────────────────────
  ipcMain.handle('cowork:session:saveResultImage', async (
    event,
    options: {
      pngBase64: string;
      defaultFileName?: string;
    }
  ) => {
    try {
      const base64 = typeof options?.pngBase64 === 'string' ? options.pngBase64.trim() : '';
      if (!base64) {
        return { success: false, error: 'Image data is required' };
      }

      const pngBuffer = Buffer.from(base64, 'base64');
      if (pngBuffer.length <= 0) {
        return { success: false, error: 'Invalid image data' };
      }

      return savePngWithDialog(event.sender, pngBuffer, options?.defaultFileName);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save session image',
      };
    }
  });

  // ── cowork:session:exportText ─────────────────────────────────────────
  ipcMain.handle('cowork:session:exportText', async (
    event,
    options: {
      content: string;
      defaultFileName?: string;
      fileExtension?: string;
    }
  ) => {
    try {
      const content = typeof options?.content === 'string' ? options.content : '';
      if (!content) {
        return { success: false, error: 'Export content is empty' };
      }

      const ext = options?.fileExtension || 'md';
      const filterName = ext === 'json' ? 'JSON' : 'Markdown';
      const defaultName = options?.defaultFileName || `session-export.${ext}`;
      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      const saveOptions = {
        title: 'Export Session',
        defaultPath: path.join(app.getPath('downloads'), defaultName),
        filters: [{ name: filterName, extensions: [ext] }],
      };
      const saveResult = ownerWindow
        ? await dialog.showSaveDialog(ownerWindow, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: true, canceled: true };
      }

      await fs.promises.writeFile(saveResult.filePath, content, 'utf-8');
      return { success: true, canceled: false, path: saveResult.filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export session',
      };
    }
  });

  // =====================================================================
  //  CLIPBOARD
  // =====================================================================

  // ── cowork:clipboard:copy ─────────────────────────────────────────────
  ipcMain.handle('cowork:clipboard:copy', async (
    _event,
    options: { text?: string; imageBase64?: string }
  ) => {
    try {
      const { text, imageBase64 } = options || {};

      if (imageBase64) {
        const pngBuffer = Buffer.from(imageBase64, 'base64');
        const image = nativeImage.createFromBuffer(pngBuffer);
        if (image.isEmpty()) {
          return { success: false, error: 'Invalid image data' };
        }
        clipboard.write({ text: text || '', image });
      } else if (text) {
        clipboard.writeText(text);
      } else {
        return { success: false, error: 'Nothing to copy' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Clipboard write failed' };
    }
  });

  // =====================================================================
  //  PERMISSION
  // =====================================================================

  // ── cowork:permission:respond ─────────────────────────────────────────
  ipcMain.handle('cowork:permission:respond', async (_event, options: {
    requestId: string;
    result: import('@anthropic-ai/claude-agent-sdk').PermissionResult;
  }) => {
    try {
      // Dual-dispatch pattern: permission responses arrive through one IPC channel
      // but may target either of two independent subsystems.
      const runtime = getCoworkEngineRouter();
      runtime.respondToPermission(options.requestId, options.result);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to respond to permission',
      };
    }
  });

  // =====================================================================
  //  CONFIG
  // =====================================================================

  // ── cowork:config:get ─────────────────────────────────────────────────
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

  // ── cowork:config:set ─────────────────────────────────────────────────
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
            Math.min(MAX_MEMORY_USER_MEMORIES_MAX_ITEMS, Math.floor(config.memoryUserMemoriesMaxItems))
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
        // Sync MEMORY.md to new workspace directory
        const syncResult = syncMemoryFileOnWorkspaceChange(previousWorkingDir, normalizedConfig.workingDirectory);
        if (syncResult.error) {
          console.warn('[OpenClaw Memory] Workspace sync failed:', syncResult.error);
        }
        // Ensure IDENTITY.md has default content in the new workspace
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

  // ── cowork:agentEngines:list ──────────────────────────────────────────
  ipcMain.handle('cowork:agentEngines:list', async () => {
    try {
      return {
        success: true,
        snapshot: getMergedExternalAgentEnvironmentSnapshot(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read agent engine status',
      };
    }
  });

  // =====================================================================
  //  RUNTIME METRICS
  // =====================================================================

  ipcMain.handle(CoworkIpcChannel.RuntimeMetricsSummary, async (_event, input: unknown) => {
    try {
      const filters = normalizeRuntimeMetricsFilters(input);
      return { success: true, summary: getRuntimeTelemetryStore().getSummary(filters) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load runtime metrics summary',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.RuntimeMetricsCalls, async (_event, input: unknown) => {
    try {
      const filters = normalizeRuntimeMetricsFilters(input);
      return { success: true, ...getRuntimeTelemetryStore().listCalls(filters) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load runtime calls',
      };
    }
  });

  ipcMain.handle(CoworkIpcChannel.RuntimeMetricsDetail, async (_event, input: { callId?: unknown }) => {
    try {
      if (typeof input?.callId !== 'string' || !input.callId.trim()) {
        return { success: false, error: 'Invalid runtime call id.' };
      }
      return { success: true, ...getRuntimeTelemetryStore().getDetail(input.callId.trim()) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load runtime call detail',
      };
    }
  });

  // =====================================================================
  //  STUDIO ASSETS
  // =====================================================================

  ipcMain.handle(CoworkIpcChannel.StudioAssetsEnsure, async () => {
    const { ensureCoworkStudioAssets } = require('../libs/coworkStudioAssets');
    return ensureCoworkStudioAssets();
  });

  // =====================================================================
  //  AGENT CLI
  // =====================================================================

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
      const result = importLocalAgentConfigToModelSettings(getStore(), input.appType);
      if (result.imported) {
        refreshEndpointsTestMode(getStore());
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

  // =====================================================================
  //  AGENT PROVIDERS
  // =====================================================================

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

  // =====================================================================
  //  MEMORY (cowork:memory:*)
  // =====================================================================

  // ── cowork:memory:listEntries ─────────────────────────────────────────
  ipcMain.handle('cowork:memory:listEntries', async (_event, input: {
    query?: string;
    status?: 'created' | 'stale' | 'deleted' | 'all';
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    try {
      const config = getCoworkStore().getConfig();
      const filePath = resolveMemoryFilePath(config.workingDirectory);

      // Lazy migration: SQLite → MEMORY.md (one-time, cached in memory)
      if (!memoryMigrationDone) {
        migrateSqliteToMemoryMd(filePath, {
          isMigrationDone: () => getStore().get<string>('openclawMemory.migration.v1.completed') === '1',
          markMigrationDone: () => {
            getStore().set('openclawMemory.migration.v1.completed', '1');
            memoryMigrationDone = true;
          },
          getActiveMemoryTexts: () => {
            return getCoworkStore().listUserMemories({ status: 'all', includeDeleted: false, limit: 200 })
              .map((m: { text: string }) => m.text);
          },
        });
        // Even if migration found nothing, skip future checks this session
        memoryMigrationDone = true;
      }

      const query = input?.query?.trim() || '';
      const entries = query
        ? searchMemoryEntries(filePath, query)
        : readMemoryEntries(filePath);
      return { success: true, entries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list memory entries',
      };
    }
  });

  // ── cowork:memory:createEntry ─────────────────────────────────────────
  ipcMain.handle('cowork:memory:createEntry', async (_event, input: {
    text: string;
    confidence?: number;
    isExplicit?: boolean;
  }) => {
    try {
      const config = getCoworkStore().getConfig();
      const filePath = resolveMemoryFilePath(config.workingDirectory);
      const entry = addMemoryEntry(filePath, input.text);
      return { success: true, entry };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create memory entry',
      };
    }
  });

  // ── cowork:memory:updateEntry ─────────────────────────────────────────
  ipcMain.handle('cowork:memory:updateEntry', async (_event, input: {
    id: string;
    text?: string;
    confidence?: number;
    status?: 'created' | 'stale' | 'deleted';
    isExplicit?: boolean;
  }) => {
    try {
      const config = getCoworkStore().getConfig();
      const filePath = resolveMemoryFilePath(config.workingDirectory);
      if (!input.text) {
        return { success: false, error: 'Memory text is required' };
      }
      const entry = updateMemoryEntry(filePath, input.id, input.text);
      if (!entry) {
        return { success: false, error: 'Memory entry not found' };
      }
      return { success: true, entry };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update memory entry',
      };
    }
  });

  // ── cowork:memory:deleteEntry ─────────────────────────────────────────
  ipcMain.handle('cowork:memory:deleteEntry', async (_event, input: {
    id: string;
  }) => {
    try {
      const config = getCoworkStore().getConfig();
      const filePath = resolveMemoryFilePath(config.workingDirectory);
      const success = deleteMemoryEntry(filePath, input.id);
      return success
        ? { success: true }
        : { success: false, error: 'Memory entry not found' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete memory entry',
      };
    }
  });

  // ── cowork:memory:getStats ────────────────────────────────────────────
  ipcMain.handle('cowork:memory:getStats', async () => {
    try {
      const config = getCoworkStore().getConfig();
      const filePath = resolveMemoryFilePath(config.workingDirectory);
      const entries = readMemoryEntries(filePath);
      return {
        success: true,
        stats: {
          total: entries.length,
          created: entries.length,
          stale: 0,
          deleted: 0,
          explicit: entries.length,
          implicit: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get memory stats',
      };
    }
  });

  // =====================================================================
  //  BOOTSTRAP FILES (cowork:bootstrap:*)
  // =====================================================================

  // ── cowork:bootstrap:read ─────────────────────────────────────────────
  ipcMain.handle('cowork:bootstrap:read', async (_event, filename: string) => {
    try {
      const config = getCoworkStore().getConfig();
      const content = readBootstrapFile(config.workingDirectory, filename);
      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Failed to read bootstrap file',
      };
    }
  });

  // ── cowork:bootstrap:write ────────────────────────────────────────────
  ipcMain.handle('cowork:bootstrap:write', async (_event, filename: string, content: string) => {
    try {
      const config = getCoworkStore().getConfig();
      writeBootstrapFile(config.workingDirectory, filename, content);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write bootstrap file',
      };
    }
  });
}

// ── Internal helper (moved from main.ts) ──────────────────────────────────

async function savePngWithDialog(
  webContents: Electron.WebContents,
  pngData: Buffer,
  defaultFileName?: string,
): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }> {
  const defaultName = getDefaultExportImageName(defaultFileName);
  const ownerWindow = BrowserWindow.fromWebContents(webContents);
  const saveOptions = {
    title: 'Save Screenshot',
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  };
  const saveResult = ownerWindow
    ? await dialog.showSaveDialog(ownerWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions);

  if (saveResult.canceled || !saveResult.filePath) {
    return { success: true, canceled: true };
  }

  await fs.promises.writeFile(saveResult.filePath, pngData);
  return { success: true, canceled: false, path: saveResult.filePath };
}
