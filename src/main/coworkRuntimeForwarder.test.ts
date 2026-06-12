import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core/ipcUtils', () => ({
  IPC_UPDATE_CONTENT_MAX_CHARS: 120000,
  sanitizeCoworkFileActivityForIpc: vi.fn((activity) => ({
    ...activity,
    sanitized: true,
  })),
  sanitizeCoworkMessageForIpc: vi.fn((message) => ({
    ...message,
    sanitized: true,
  })),
  sanitizePermissionRequestForIpc: vi.fn((request) => ({
    ...request,
    sanitized: true,
  })),
  truncateIpcString: vi.fn((value) => `truncated:${value}`),
}));

const trackerInstances: Array<{
  startSession: ReturnType<typeof vi.fn>;
  handleToolMessage: ReturnType<typeof vi.fn>;
  stopSession: ReturnType<typeof vi.fn>;
  stopAll: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('./coworkFileActivityTracker', () => ({
  CoworkFileActivityTracker: class {
    startSession = vi.fn();
    handleToolMessage = vi.fn();
    stopSession = vi.fn();
    stopAll = vi.fn();

    constructor() {
      trackerInstances.push(this);
    }
  },
}));

import { createCoworkRuntimeForwarder } from './coworkRuntimeForwarder';

class RuntimeEmitter extends EventEmitter {
  getSessionConfirmationMode = vi.fn().mockReturnValue('modal');
}

describe('coworkRuntimeForwarder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackerInstances.length = 0;
  });

  it('binds runtime events once and forwards message/update/permission events', () => {
    const send = vi.fn();
    const runtime = new RuntimeEmitter();
    const coworkStore = {
      getSession: vi.fn().mockReturnValue({ cwd: '/workspace' }),
      updateSession: vi.fn(),
    };
    const forwarder = createCoworkRuntimeForwarder({
      getWindows: () => [
        {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send },
        } as never,
      ],
      getCoworkStore: () => coworkStore as never,
      getCoworkEngineRouter: () => runtime as never,
      shouldBroadcastQuotaChanged: () => true,
    });

    forwarder.bind();
    forwarder.bind();

    runtime.emit('message', 'session-1', {
      id: 'msg-1',
      type: 'assistant',
      content: 'hello',
    });
    expect(trackerInstances[0]?.startSession).toHaveBeenCalledWith(
      'session-1',
      '/workspace',
    );
    expect(trackerInstances[0]?.handleToolMessage).toHaveBeenCalledWith(
      'session-1',
      '/workspace',
      expect.objectContaining({ id: 'msg-1' }),
    );
    expect(send).toHaveBeenCalledWith('cowork:stream:message', {
      sessionId: 'session-1',
      message: expect.objectContaining({
        id: 'msg-1',
        sanitized: true,
      }),
    });

    runtime.emit('messageUpdate', 'session-1', 'msg-1', 'next chunk');
    expect(send).toHaveBeenCalledWith('cowork:stream:messageUpdate', {
      sessionId: 'session-1',
      messageId: 'msg-1',
      content: 'truncated:next chunk',
    });

    runtime.emit('permissionRequest', 'session-1', {
      requestId: 'perm-1',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    });
    expect(send).toHaveBeenCalledWith('cowork:stream:permission', {
      sessionId: 'session-1',
      request: expect.objectContaining({
        requestId: 'perm-1',
        sanitized: true,
      }),
    });
    forwarder.getPermissionManager().approvePermission('perm-1', {
      behavior: 'allow',
      updatedInput: { command: 'ls' },
    });
    expect(send).toHaveBeenCalledWith('cowork:stream:permissionDismiss', {
      requestId: 'perm-1',
    });

    runtime.getSessionConfirmationMode.mockReturnValue('text');
    runtime.emit('permissionRequest', 'session-1', { requestId: 'perm-2' });
    expect(send).not.toHaveBeenCalledWith('cowork:stream:permission', {
      sessionId: 'session-1',
      request: expect.objectContaining({ requestId: 'perm-2' }),
    });
  });

  it('forwards complete/error/sessionStopped events and handles quota notifications conditionally', () => {
    const send = vi.fn();
    const runtime = new RuntimeEmitter();
    const coworkStore = {
      getSession: vi.fn().mockReturnValue({ cwd: '/workspace' }),
      updateSession: vi.fn(),
    };
    const forwarder = createCoworkRuntimeForwarder({
      getWindows: () => [
        {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send },
        } as never,
      ],
      getCoworkStore: () => coworkStore as never,
      getCoworkEngineRouter: () => runtime as never,
      shouldBroadcastQuotaChanged: () => true,
    });

    forwarder.bind();
    forwarder.getFileActivityTracker();
    runtime.emit('permissionRequest', 'session-1', {
      requestId: 'perm-1',
      toolName: 'Bash',
      toolInput: { command: 'rm -rf tmp' },
    });

    runtime.emit('complete', 'session-1', 'claude-1');
    expect(trackerInstances[0]?.stopSession).toHaveBeenCalledWith(
      'session-1',
      1200,
    );
    expect(send).toHaveBeenCalledWith('cowork:stream:complete', {
      sessionId: 'session-1',
      claudeSessionId: 'claude-1',
    });
    expect(send).toHaveBeenCalledWith('cowork:stream:permissionDismiss', {
      requestId: 'perm-1',
    });
    expect(send).toHaveBeenCalledWith('auth:quotaChanged');

    runtime.emit('error', 'session-1', 'boom');
    expect(coworkStore.updateSession).toHaveBeenCalledWith('session-1', {
      status: 'error',
    });
    expect(send).toHaveBeenCalledWith('cowork:stream:error', {
      sessionId: 'session-1',
      error: 'boom',
    });

    runtime.emit('sessionStopped', 'session-1');
    expect(trackerInstances[0]?.stopSession).toHaveBeenCalledWith('session-1');
  });

  it('broadcasts manual messages/errors and session changes, and skips destroyed windows', () => {
    const activeSend = vi.fn();
    const destroyedSend = vi.fn();
    const runtime = new RuntimeEmitter();
    const forwarder = createCoworkRuntimeForwarder({
      getWindows: () => [
        {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send: activeSend },
        } as never,
        {
          isDestroyed: vi.fn().mockReturnValue(true),
          webContents: { send: destroyedSend },
        } as never,
      ],
      getCoworkStore: () =>
        ({
          getSession: vi.fn(),
        }) as never,
      getCoworkEngineRouter: () => runtime as never,
      shouldBroadcastQuotaChanged: () => false,
    });

    forwarder.broadcastSessionsChanged();
    forwarder.broadcastMessage('session-1', {
      id: 'msg-1',
      type: 'assistant',
      content: 'hello',
    } as never);
    forwarder.broadcastError('session-1', 'boom');

    expect(activeSend).toHaveBeenCalledWith('cowork:sessions:changed');
    expect(activeSend).toHaveBeenCalledWith('cowork:stream:message', {
      sessionId: 'session-1',
      message: expect.objectContaining({
        id: 'msg-1',
        sanitized: true,
      }),
    });
    expect(activeSend).toHaveBeenCalledWith('cowork:stream:error', {
      sessionId: 'session-1',
      error: 'boom',
    });
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it('stops all file activity when requested', () => {
    const runtime = new RuntimeEmitter();
    const forwarder = createCoworkRuntimeForwarder({
      getWindows: () => [],
      getCoworkStore: () =>
        ({
          getSession: vi.fn(),
        }) as never,
      getCoworkEngineRouter: () => runtime as never,
      shouldBroadcastQuotaChanged: () => false,
    });

    forwarder.getFileActivityTracker();
    forwarder.stopFileActivity();

    expect(trackerInstances[0]?.stopAll).toHaveBeenCalledTimes(1);
  });
});
