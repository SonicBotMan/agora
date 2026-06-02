/**
 * Agora — Session / Cowork IPC Handlers
 * Session lifecycle, engine routing, message streaming, agent management.
 * Largest handler group (55 handlers).
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';

export interface SessionInfo {
  id: string;
  name: string;
  engine: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status: 'active' | 'idle' | 'error' | 'terminated';
}

export interface MessagePayload {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: AttachmentInfo[];
  metadata?: Record<string, unknown>;
}

export interface AttachmentInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  path?: string;
}

export interface SessionDeps {
  // Session CRUD
  createSession: (engine: string, options?: Record<string, unknown>) => Promise<SessionInfo>;
  getSession: (id: string) => Promise<SessionInfo | null>;
  listSessions: () => Promise<SessionInfo[]>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  duplicateSession: (id: string) => Promise<SessionInfo>;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;
  clearSessionHistory: (id: string) => Promise<void>;
  getSessionHistory: (id: string, limit?: number, offset?: number) => Promise<MessagePayload[]>;
  exportSession: (id: string, format: 'markdown' | 'json') => Promise<string>;
  importSession: (filePath: string) => Promise<SessionInfo>;
  searchSessions: (query: string) => Promise<SessionInfo[]>;

  // Engine / Runtime
  switchEngine: (sessionId: string, engine: string) => Promise<void>;
  getAvailableEngines: () => Promise<{ id: string; name: string; available: boolean }[]>;
  getEngineStatus: (sessionId: string) => Promise<Record<string, unknown>>;
  restartEngine: (sessionId: string) => Promise<void>;
  setEngineConfig: (engine: string, config: Record<string, unknown>) => Promise<void>;
  getEngineConfig: (engine: string) => Promise<Record<string, unknown>>;

  // Messaging
  sendMessage: (sessionId: string, message: MessagePayload) => Promise<void>;
  sendMessageStream: (sessionId: string, message: MessagePayload) => AsyncGenerator<string>;
  cancelMessage: (sessionId: string) => Promise<void>;
  retryLastMessage: (sessionId: string) => Promise<void>;
  editMessage: (sessionId: string, messageIndex: number, newContent: string) => Promise<void>;

  // Agent management
  setSystemPrompt: (sessionId: string, prompt: string) => Promise<void>;
  getSystemPrompt: (sessionId: string) => Promise<string>;
  setModel: (sessionId: string, model: string) => Promise<void>;
  getModel: (sessionId: string) => Promise<string | null>;
  setTemperature: (sessionId: string, temp: number) => Promise<void>;
  getMaxTokens: (sessionId: string) => Promise<number>;
  setMaxTokens: (sessionId: string, max: number) => Promise<void>;

  // Attachment handling
  uploadAttachment: (sessionId: string, filePath: string) => Promise<AttachmentInfo>;
  deleteAttachment: (sessionId: string, attachmentId: string) => Promise<void>;
  getAttachments: (sessionId: string) => Promise<AttachmentInfo[]>;

  // Telemetry
  getSessionTelemetry: (sessionId: string) => Promise<Record<string, unknown>>;
  getRuntimeTelemetry: () => Promise<Record<string, unknown>>;

  // Cowork (multi-agent)
  createCoworkSession: (options: {
    engines: string[];
    task: string;
    mode: 'parallel' | 'sequential' | 'collaborative';
  }) => Promise<SessionInfo>;
  getCoworkStatus: (sessionId: string) => Promise<Record<string, unknown>>;
  stopCowork: (sessionId: string) => Promise<void>;
  addCoworkAgent: (sessionId: string, engine: string) => Promise<void>;
  removeCoworkAgent: (sessionId: string, engine: string) => Promise<void>;
}

export function registerSessionHandlers(deps: SessionDeps): void {
  // ── Session CRUD ─────────────────────────────────────
  ipcMain.handle('session:create', async (_event, engine: string, options?: Record<string, unknown>) => {
    return deps.createSession(engine, options);
  });
  ipcMain.handle('session:get', async (_event, id: string) => deps.getSession(id));
  ipcMain.handle('session:list', async () => deps.listSessions());
  ipcMain.handle('session:delete', async (_event, id: string) => deps.deleteSession(id));
  ipcMain.handle('session:rename', async (_event, id: string, name: string) => deps.renameSession(id, name));
  ipcMain.handle('session:duplicate', async (_event, id: string) => deps.duplicateSession(id));
  ipcMain.handle('session:archive', async (_event, id: string) => deps.archiveSession(id));
  ipcMain.handle('session:unarchive', async (_event, id: string) => deps.unarchiveSession(id));
  ipcMain.handle('session:clearHistory', async (_event, id: string) => deps.clearSessionHistory(id));
  ipcMain.handle('session:getHistory', async (_event, id: string, limit?: number, offset?: number) => {
    return deps.getSessionHistory(id, limit, offset);
  });
  ipcMain.handle('session:export', async (_event, id: string, format: 'markdown' | 'json') => {
    return deps.exportSession(id, format);
  });
  ipcMain.handle('session:import', async (_event, filePath: string) => deps.importSession(filePath));
  ipcMain.handle('session:search', async (_event, query: string) => deps.searchSessions(query));

  // ── Engine / Runtime ─────────────────────────────────
  ipcMain.handle('session:switchEngine', async (_event, sessionId: string, engine: string) => {
    await deps.switchEngine(sessionId, engine);
  });
  ipcMain.handle('session:getEngines', async () => deps.getAvailableEngines());
  ipcMain.handle('session:getEngineStatus', async (_event, sessionId: string) => {
    return deps.getEngineStatus(sessionId);
  });
  ipcMain.handle('session:restartEngine', async (_event, sessionId: string) => {
    await deps.restartEngine(sessionId);
  });
  ipcMain.handle('session:setEngineConfig', async (_event, engine: string, config: Record<string, unknown>) => {
    await deps.setEngineConfig(engine, config);
  });
  ipcMain.handle('session:getEngineConfig', async (_event, engine: string) => {
    return deps.getEngineConfig(engine);
  });

  // ── Messaging ────────────────────────────────────────
  ipcMain.handle('session:sendMessage', async (_event, sessionId: string, message: MessagePayload) => {
    await deps.sendMessage(sessionId, message);
  });
  ipcMain.handle('session:sendMessageStream', async (event: IpcMainInvokeEvent, sessionId: string, message: MessagePayload) => {
    const stream = deps.sendMessageStream(sessionId, message);
    for await (const chunk of stream) {
      event.sender.send('session:streamChunk', sessionId, chunk);
    }
    event.sender.send('session:streamEnd', sessionId);
  });
  ipcMain.handle('session:cancelMessage', async (_event, sessionId: string) => {
    await deps.cancelMessage(sessionId);
  });
  ipcMain.handle('session:retryLastMessage', async (_event, sessionId: string) => {
    await deps.retryLastMessage(sessionId);
  });
  ipcMain.handle('session:editMessage', async (_event, sessionId: string, messageIndex: number, newContent: string) => {
    await deps.editMessage(sessionId, messageIndex, newContent);
  });

  // ── Agent Config ─────────────────────────────────────
  ipcMain.handle('session:setSystemPrompt', async (_event, sessionId: string, prompt: string) => {
    await deps.setSystemPrompt(sessionId, prompt);
  });
  ipcMain.handle('session:getSystemPrompt', async (_event, sessionId: string) => {
    return deps.getSystemPrompt(sessionId);
  });
  ipcMain.handle('session:setModel', async (_event, sessionId: string, model: string) => {
    await deps.setModel(sessionId, model);
  });
  ipcMain.handle('session:getModel', async (_event, sessionId: string) => {
    return deps.getModel(sessionId);
  });
  ipcMain.handle('session:setTemperature', async (_event, sessionId: string, temp: number) => {
    await deps.setTemperature(sessionId, temp);
  });
  ipcMain.handle('session:getMaxTokens', async (_event, sessionId: string) => {
    return deps.getMaxTokens(sessionId);
  });
  ipcMain.handle('session:setMaxTokens', async (_event, sessionId: string, max: number) => {
    await deps.setMaxTokens(sessionId, max);
  });

  // ── Attachments ──────────────────────────────────────
  ipcMain.handle('session:uploadAttachment', async (_event, sessionId: string, filePath: string) => {
    return deps.uploadAttachment(sessionId, filePath);
  });
  ipcMain.handle('session:deleteAttachment', async (_event, sessionId: string, attachmentId: string) => {
    await deps.deleteAttachment(sessionId, attachmentId);
  });
  ipcMain.handle('session:getAttachments', async (_event, sessionId: string) => {
    return deps.getAttachments(sessionId);
  });

  // ── Telemetry ────────────────────────────────────────
  ipcMain.handle('session:getTelemetry', async (_event, sessionId: string) => {
    return deps.getSessionTelemetry(sessionId);
  });
  ipcMain.handle('session:getRuntimeTelemetry', async () => {
    return deps.getRuntimeTelemetry();
  });

  // ── Cowork (multi-agent) ─────────────────────────────
  ipcMain.handle('cowork:create', async (_event, options: {
    engines: string[];
    task: string;
    mode: 'parallel' | 'sequential' | 'collaborative';
  }) => deps.createCoworkSession(options));
  ipcMain.handle('cowork:getStatus', async (_event, sessionId: string) => deps.getCoworkStatus(sessionId));
  ipcMain.handle('cowork:stop', async (_event, sessionId: string) => deps.stopCowork(sessionId));
  ipcMain.handle('cowork:addAgent', async (_event, sessionId: string, engine: string) => {
    await deps.addCoworkAgent(sessionId, engine);
  });
  ipcMain.handle('cowork:removeAgent', async (_event, sessionId: string, engine: string) => {
    await deps.removeCoworkAgent(sessionId, engine);
  });
}
