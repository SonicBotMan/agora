import type { BrowserWindow } from 'electron';

import { PermissionManager } from '../core/PermissionManager';
import { CoworkIpcChannel } from '../shared/cowork/constants';
import {
  IPC_UPDATE_CONTENT_MAX_CHARS,
  sanitizeCoworkFileActivityForIpc,
  sanitizeCoworkMessageForIpc,
  sanitizePermissionRequestForIpc,
  truncateIpcString,
} from './core/ipcUtils';
import { CoworkFileActivityTracker } from './coworkFileActivityTracker';
import type { CoworkMessage, CoworkStore } from './coworkStore';
import type { CoworkEngineRouter } from './libs/agentEngine';
import type { PermissionRequest } from './libs/agentEngine/types';

export interface CoworkRuntimeForwarderDeps {
  getWindows: () => BrowserWindow[];
  getCoworkStore: () => CoworkStore;
  getCoworkEngineRouter: () => CoworkEngineRouter;
  shouldBroadcastQuotaChanged: () => boolean;
}

export interface CoworkRuntimeForwarder {
  bind: () => void;
  broadcastSessionsChanged: () => void;
  broadcastMessage: (sessionId: string, message: CoworkMessage) => void;
  broadcastError: (sessionId: string, error: string) => void;
  getFileActivityTracker: () => CoworkFileActivityTracker;
  getPermissionManager: () => PermissionManager;
  stopFileActivity: () => void;
}

export function createCoworkRuntimeForwarder(
  deps: CoworkRuntimeForwarderDeps,
): CoworkRuntimeForwarder {
  let coworkFileActivityTracker: CoworkFileActivityTracker | null = null;
  let permissionManager: PermissionManager | null = null;
  let isBound = false;

  const broadcastSessionsChanged = (): void => {
    deps.getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send('cowork:sessions:changed');
      } catch (error) {
        console.error('[Cowork] Failed to broadcast session changes:', error);
      }
    });
  };

  const getFileActivityTracker = (): CoworkFileActivityTracker => {
    if (!coworkFileActivityTracker) {
      coworkFileActivityTracker = new CoworkFileActivityTracker((activity) => {
        const safeActivity = sanitizeCoworkFileActivityForIpc(activity);
        deps.getWindows().forEach((win) => {
          if (win.isDestroyed()) return;
          try {
            win.webContents.send(CoworkIpcChannel.StreamFileActivity, {
              sessionId: activity.sessionId,
              activity: safeActivity,
            });
          } catch (error) {
            console.error(
              '[CoworkFileActivity] failed to forward file activity:',
              error,
            );
          }
        });
      });
    }
    return coworkFileActivityTracker;
  };

  const broadcastPermissionDismiss = (requestId: string): void => {
    deps.getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send('cowork:stream:permissionDismiss', {
          requestId,
        });
      } catch (error) {
        console.error('Failed to forward cowork permission dismissal:', error);
      }
    });
  };

  const getPermissionManager = (): PermissionManager => {
    if (!permissionManager) {
      permissionManager = new PermissionManager();
      permissionManager.on('requestResolved', ({ permission }) => {
        broadcastPermissionDismiss(permission.requestId);
      });
      permissionManager.on('requestDismissed', ({ permission }) => {
        broadcastPermissionDismiss(permission.requestId);
      });
    }
    return permissionManager;
  };

  const startFileActivityForSession = (sessionId: string): void => {
    try {
      const session = deps.getCoworkStore().getSession(sessionId);
      if (!session?.cwd) return;
      getFileActivityTracker().startSession(sessionId, session.cwd);
    } catch {
      // Session may not exist yet for very early channel events.
    }
  };

  const bind = (): void => {
    if (isBound) return;

    const runtime = deps.getCoworkEngineRouter();

    runtime.on('message', (sessionId: string, message: CoworkMessage) => {
      startFileActivityForSession(sessionId);
      try {
        const session = deps.getCoworkStore().getSession(sessionId);
        if (session?.cwd) {
          getFileActivityTracker().handleToolMessage(
            sessionId,
            session.cwd,
            message,
          );
        }
      } catch {
        // File activity is best-effort and must not block message rendering.
      }

      const safeMessage = sanitizeCoworkMessageForIpc(message);
      const windows = deps.getWindows();
      console.log(
        '[CoworkForwarder] forwarding message: sessionId=',
        sessionId,
        'type=',
        message?.type,
        'windowCount=',
        windows.length,
      );
      windows.forEach((win) => {
        if (win.isDestroyed()) return;
        try {
          win.webContents.send('cowork:stream:message', {
            sessionId,
            message: safeMessage,
          });
        } catch (error) {
          console.error('Failed to forward cowork message:', error);
        }
      });
    });

    runtime.on(
      'messageUpdate',
      (sessionId: string, messageId: string, content: string) => {
        startFileActivityForSession(sessionId);
        const safeContent = truncateIpcString(
          content,
          IPC_UPDATE_CONTENT_MAX_CHARS,
        );
        deps.getWindows().forEach((win) => {
          if (win.isDestroyed()) return;
          try {
            win.webContents.send('cowork:stream:messageUpdate', {
              sessionId,
              messageId,
              content: safeContent,
            });
          } catch (error) {
            console.error('Failed to forward cowork message update:', error);
          }
        });
      },
    );

    runtime.on('permissionRequest', (sessionId: string, request: unknown) => {
      if (runtime.getSessionConfirmationMode(sessionId) === 'text') {
        return;
      }
      getPermissionManager().requestPermission(
        sessionId,
        request as PermissionRequest,
      );
      const safeRequest = sanitizePermissionRequestForIpc(request);
      deps.getWindows().forEach((win) => {
        if (win.isDestroyed()) return;
        try {
          win.webContents.send('cowork:stream:permission', {
            sessionId,
            request: safeRequest,
          });
        } catch (error) {
          console.error('Failed to forward cowork permission request:', error);
        }
      });
    });

    runtime.on(
      'complete',
      (sessionId: string, claudeSessionId: string | null) => {
        getFileActivityTracker().stopSession(sessionId, 1200);
        getPermissionManager().dismissSessionPermissions(
          sessionId,
          'session-complete',
        );
        deps.getWindows().forEach((win) => {
          if (win.isDestroyed()) return;
          win.webContents.send('cowork:stream:complete', {
            sessionId,
            claudeSessionId,
          });
        });

        if (!deps.shouldBroadcastQuotaChanged()) {
          return;
        }

        deps.getWindows().forEach((win) => {
          if (win.isDestroyed()) return;
          win.webContents.send('auth:quotaChanged');
        });
      },
    );

    runtime.on('error', (sessionId: string, error: string) => {
      getFileActivityTracker().stopSession(sessionId, 1200);
      getPermissionManager().dismissSessionPermissions(
        sessionId,
        'session-error',
      );
      try {
        deps.getCoworkStore().updateSession(sessionId, { status: 'error' });
      } catch {
        // ignore
      }
      deps.getWindows().forEach((win) => {
        if (win.isDestroyed()) return;
        win.webContents.send('cowork:stream:error', { sessionId, error });
      });
    });

    runtime.on('sessionStopped', (sessionId: string) => {
      getFileActivityTracker().stopSession(sessionId);
      getPermissionManager().dismissSessionPermissions(
        sessionId,
        'session-stopped',
      );
    });

    isBound = true;
  };

  const broadcastMessage = (
    sessionId: string,
    message: CoworkMessage,
  ): void => {
    const safeMessage = sanitizeCoworkMessageForIpc(message);
    deps.getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send('cowork:stream:message', {
          sessionId,
          message: safeMessage,
        });
      } catch (error) {
        console.error(
          '[CoworkForwarder] failed to broadcast manual message:',
          error,
        );
      }
    });
    broadcastSessionsChanged();
  };

  const broadcastError = (sessionId: string, error: string): void => {
    deps.getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      win.webContents.send('cowork:stream:error', { sessionId, error });
    });
    broadcastSessionsChanged();
  };

  const stopFileActivity = (): void => {
    coworkFileActivityTracker?.stopAll();
  };

  return {
    bind,
    broadcastSessionsChanged,
    broadcastMessage,
    broadcastError,
    getFileActivityTracker,
    getPermissionManager,
    stopFileActivity,
  };
}
