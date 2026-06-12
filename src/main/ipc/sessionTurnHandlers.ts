import { BrowserWindow, ipcMain } from 'electron';

import { CoworkSessionKind, RuntimeCallSource } from '../../shared/cowork/constants';
import type {
  SessionContinueOptions,
  SessionDeps,
  SessionStartOptions,
} from './sessionDeps';

export type SessionTurnDeps = Pick<
  SessionDeps,
  | 'getCoworkStore'
  | 'getCoworkEngineRouter'
  | 'getCoworkFileActivityTracker'
  | 'getAgentTeamRunner'
  | 'resolveCoworkAgentEngine'
  | 'resolveAgentRuntimeEngine'
  | 'ensureCoworkEngineReady'
  | 'getEngineNotReadyResponse'
  | 'mergeCoworkSystemPrompt'
  | 'applyExternalAgentConfigSourceForEngine'
  | 'resolveSessionRuntimeSnapshot'
  | 'prepareRuntimeSnapshotForTurn'
  | 'resolveTaskWorkingDirectory'
  | 'broadcastCoworkMessage'
  | 'broadcastCoworkError'
>;

function broadcastSessionStreamError(
  sessionId: string,
  error: unknown,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    if (win.isDestroyed()) return;
    win.webContents.send('cowork:stream:error', { sessionId, error: errorMessage });
  });
}

export function registerSessionTurnHandlers(deps: SessionTurnDeps): void {
  const {
    getCoworkStore,
    getCoworkEngineRouter,
    getCoworkFileActivityTracker,
    getAgentTeamRunner,
    resolveCoworkAgentEngine,
    resolveAgentRuntimeEngine,
    ensureCoworkEngineReady,
    getEngineNotReadyResponse,
    mergeCoworkSystemPrompt,
    applyExternalAgentConfigSourceForEngine,
    resolveSessionRuntimeSnapshot,
    prepareRuntimeSnapshotForTurn,
    resolveTaskWorkingDirectory,
    broadcastCoworkMessage,
    broadcastCoworkError,
  } = deps;

  ipcMain.handle('cowork:session:start', async (_event, options: SessionStartOptions) => {
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

      coworkStoreInstance.updateSession(session.id, { status: 'running' });

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
        broadcastSessionStreamError(session.id, error);
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

  ipcMain.handle('cowork:session:continue', async (_event, options: SessionContinueOptions) => {
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
        broadcastSessionStreamError(options.sessionId, error);
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
}
