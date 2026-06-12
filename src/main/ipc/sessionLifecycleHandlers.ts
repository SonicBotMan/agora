import { ipcMain } from 'electron';

import type { SessionDeps, SessionPinOptions, SessionRenameOptions } from './sessionDeps';

export type SessionLifecycleDeps = Pick<
  SessionDeps,
  | 'getCoworkStore'
  | 'getCoworkEngineRouter'
  | 'getCoworkFileActivityTracker'
  | 'getRuntimeTelemetryStore'
  | 'getIMGatewayManager'
>;

function cleanupDeletedSession(
  deps: SessionLifecycleDeps,
  sessionId: string,
): void {
  try {
    deps.getIMGatewayManager()?.getIMStore()?.deleteSessionMappingByCoworkSessionId(sessionId);
  } catch {
    // IM store may not be initialised yet; safe to ignore.
  }
  try {
    deps.getCoworkEngineRouter().onSessionDeleted(sessionId);
  } catch {
    // Router may not be initialised yet; safe to ignore.
  }
}

export function registerSessionLifecycleHandlers(
  deps: SessionLifecycleDeps,
): void {
  const {
    getCoworkStore,
    getCoworkEngineRouter,
    getCoworkFileActivityTracker,
    getRuntimeTelemetryStore,
    getIMGatewayManager,
  } = deps;

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

  ipcMain.handle('cowork:session:delete', async (_event, sessionId: string) => {
    try {
      getCoworkEngineRouter().stopSession(sessionId);
      getCoworkFileActivityTracker().stopSession(sessionId);
      const coworkStoreInstance = getCoworkStore();
      getRuntimeTelemetryStore().deleteBySession(sessionId);
      coworkStoreInstance.deleteSession(sessionId);
      cleanupDeletedSession(
        {
          getCoworkStore,
          getCoworkEngineRouter,
          getCoworkFileActivityTracker,
          getRuntimeTelemetryStore,
          getIMGatewayManager,
        },
        sessionId,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete session',
      };
    }
  });

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
      for (const sessionId of sessionIds) {
        cleanupDeletedSession(
          {
            getCoworkStore,
            getCoworkEngineRouter,
            getCoworkFileActivityTracker,
            getRuntimeTelemetryStore,
            getIMGatewayManager,
          },
          sessionId,
        );
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch delete sessions',
      };
    }
  });

  ipcMain.handle('cowork:session:pin', async (_event, options: SessionPinOptions) => {
    try {
      getCoworkStore().setSessionPinned(options.sessionId, options.pinned);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update session pin',
      };
    }
  });

  ipcMain.handle('cowork:session:rename', async (_event, options: SessionRenameOptions) => {
    try {
      const title = options.title.trim();
      if (!title) {
        return { success: false, error: 'Title is required' };
      }
      getCoworkStore().updateSession(options.sessionId, { title });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename session',
      };
    }
  });

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
}
