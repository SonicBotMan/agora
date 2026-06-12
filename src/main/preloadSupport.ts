/* eslint-disable @typescript-eslint/no-explicit-any */
import { type IpcRenderer, type IpcRendererEvent } from 'electron';

import { IpcChannel as ScheduledTaskIpc } from '../scheduled-task/constants';
import { CoworkIpcChannel } from '../shared/cowork/constants';
import type { CoworkFileActivity } from '../shared/cowork/fileActivity';
import { DialogIpcChannel } from '../shared/dialog/constants';
import { type FeishuEngineKeyType, type FeishuManagementModeType, type FeishuRuntimeOwnershipType, ImIpcChannel } from '../shared/im/constants';
import type { Platform } from '../shared/platform';
import { SkillsIpcChannel } from '../shared/skills/constants';

// 暴露安全的 API 到渲染进程

export type PreloadRuntimeInfo = {
  platform: NodeJS.Platform;
  arch: string;
};

export type IpcRendererLike = Pick<
  IpcRenderer,
  'invoke' | 'send' | 'on' | 'removeListener'
>;

export function createElectronPreloadApi(
  ipcRenderer: IpcRendererLike,
  runtime: PreloadRuntimeInfo = {
    platform: process.platform,
    arch: process.arch,
  },
) {
  return {
  platform: runtime.platform,
  arch: runtime.arch,
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    remove: (key: string) => ipcRenderer.invoke('store:remove', key),
  },
  skills: {
    list: () => ipcRenderer.invoke(SkillsIpcChannel.List),
    setEnabled: (options: { id: string; enabled: boolean }) => ipcRenderer.invoke(SkillsIpcChannel.SetEnabled, options),
    delete: (id: string) => ipcRenderer.invoke(SkillsIpcChannel.Delete, id),
    download: (source: string) => ipcRenderer.invoke(SkillsIpcChannel.Download, source),
    upgrade: (skillId: string, downloadUrl: string) => ipcRenderer.invoke(SkillsIpcChannel.Upgrade, skillId, downloadUrl),
    confirmInstall: (pendingId: string, action: string) =>
      ipcRenderer.invoke(SkillsIpcChannel.ConfirmInstall, pendingId, action),
    getRoot: () => ipcRenderer.invoke(SkillsIpcChannel.GetRoot),
    autoRoutingPrompt: () => ipcRenderer.invoke(SkillsIpcChannel.AutoRoutingPrompt),
    getConfig: (skillId: string) => ipcRenderer.invoke(SkillsIpcChannel.GetConfig, skillId),
    setConfig: (skillId: string, config: Record<string, string>) => ipcRenderer.invoke(SkillsIpcChannel.SetConfig, skillId, config),
    testEmailConnectivity: (skillId: string, config: Record<string, string>) =>
      ipcRenderer.invoke(SkillsIpcChannel.TestEmailConnectivity, skillId, config),
    fetchMarketplace: (options?: any) => ipcRenderer.invoke(SkillsIpcChannel.FetchMarketplace, options),
    searchMarketplace: (options?: any) => ipcRenderer.invoke(SkillsIpcChannel.SearchMarketplace, options),
    installMarketplaceSkill: (skill: any) => ipcRenderer.invoke(SkillsIpcChannel.InstallMarketplaceSkill, skill),
    onChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(SkillsIpcChannel.Changed, handler);
      return () => ipcRenderer.removeListener(SkillsIpcChannel.Changed, handler);
    },
  },
  mcp: {
    list: () => ipcRenderer.invoke('mcp:list'),
    create: (data: any) => ipcRenderer.invoke('mcp:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('mcp:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('mcp:delete', id),
    setEnabled: (options: { id: string; enabled: boolean }) => ipcRenderer.invoke('mcp:setEnabled', options),
    fetchMarketplace: () => ipcRenderer.invoke('mcp:fetchMarketplace'),
    refreshBridge: () => ipcRenderer.invoke('mcp:refreshBridge'),
    onBridgeSyncStart: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('mcp:bridge:syncStart', handler);
      return () => ipcRenderer.removeListener('mcp:bridge:syncStart', handler);
    },
    onBridgeSyncDone: (callback: (data: { tools: number; error?: string }) => void) => {
      const handler = (_event: any, data: { tools: number; error?: string }) => callback(data);
      ipcRenderer.on('mcp:bridge:syncDone', handler);
      return () => ipcRenderer.removeListener('mcp:bridge:syncDone', handler);
    },
  },
  permissions: {
    checkCalendar: () => ipcRenderer.invoke('permissions:checkCalendar'),
    requestCalendar: () => ipcRenderer.invoke('permissions:requestCalendar'),
  },
  enterprise: {
    getConfig: () => ipcRenderer.invoke('enterprise:getConfig'),
  },
  api: {
    // 普通 API 请求（非流式）
    fetch: (options: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
    }) => ipcRenderer.invoke('api:fetch', options),

    // 流式 API 请求
    stream: (options: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
      requestId: string;
    }) => ipcRenderer.invoke('api:stream', options),

    // 取消流式请求
    cancelStream: (requestId: string) => ipcRenderer.invoke('api:stream:cancel', requestId),

    // 监听流式数据
    onStreamData: (requestId: string, callback: (chunk: string) => void) => {
      const handler = (_event: any, chunk: string) => callback(chunk);
      ipcRenderer.on(`api:stream:${requestId}:data`, handler);
      return () => ipcRenderer.removeListener(`api:stream:${requestId}:data`, handler);
    },

    // 监听流式完成
    onStreamDone: (requestId: string, callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(`api:stream:${requestId}:done`, handler);
      return () => ipcRenderer.removeListener(`api:stream:${requestId}:done`, handler);
    },

    // 监听流式错误
    onStreamError: (requestId: string, callback: (error: string) => void) => {
      const handler = (_event: any, error: string) => callback(error);
      ipcRenderer.on(`api:stream:${requestId}:error`, handler);
      return () => ipcRenderer.removeListener(`api:stream:${requestId}:error`, handler);
    },

    // 监听流式取消
    onStreamAbort: (requestId: string, callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(`api:stream:${requestId}:abort`, handler);
      return () => ipcRenderer.removeListener(`api:stream:${requestId}:abort`, handler);
    },
  },
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args);
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      const handler = (_event: any, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    showSystemMenu: (position: { x: number; y: number }) => ipcRenderer.send('window:showSystemMenu', position),
    onStateChanged: (callback: (state: { isMaximized: boolean; isFullscreen: boolean; isFocused: boolean }) => void) => {
      const handler = (_event: any, state: { isMaximized: boolean; isFullscreen: boolean; isFocused: boolean }) => callback(state);
      ipcRenderer.on('window:state-changed', handler);
      return () => ipcRenderer.removeListener('window:state-changed', handler);
    },
  },
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),
  checkApiConfig: (options?: { probeModel?: boolean }) => ipcRenderer.invoke('check-api-config', options),
  saveApiConfig: (config: { apiKey: string; baseURL: string; model: string; apiType?: 'anthropic' | 'openai' }) =>
    ipcRenderer.invoke('save-api-config', config),
  generateSessionTitle: (userInput: string | null) =>
    ipcRenderer.invoke('generate-session-title', userInput),
  getRecentCwds: (limit?: number) =>
    ipcRenderer.invoke('get-recent-cwds', limit),
  openclaw: {
    engine: {
      getStatus: () => ipcRenderer.invoke('openclaw:engine:getStatus'),
      install: () => ipcRenderer.invoke('openclaw:engine:install'),
      retryInstall: () => ipcRenderer.invoke('openclaw:engine:retryInstall'),
      restartGateway: () => ipcRenderer.invoke('openclaw:engine:restartGateway'),
      onProgress: (callback: (status: any) => void) => {
        const handler = (_event: any, status: any) => callback(status);
        ipcRenderer.on('openclaw:engine:onProgress', handler);
        return () => ipcRenderer.removeListener('openclaw:engine:onProgress', handler);
      },
    },
  },
  hermes: {
    engine: {
      getStatus: () => ipcRenderer.invoke('hermes:engine:getStatus'),
      install: () => ipcRenderer.invoke('hermes:engine:install'),
      retryInstall: () => ipcRenderer.invoke('hermes:engine:retryInstall'),
      restartGateway: () => ipcRenderer.invoke('hermes:engine:restartGateway'),
      onProgress: (callback: (status: any) => void) => {
        const handler = (_event: any, status: any) => callback(status);
        ipcRenderer.on('hermes:engine:onProgress', handler);
        return () => ipcRenderer.removeListener('hermes:engine:onProgress', handler);
      },
    },
  },
  agents: {
    list: async () => {
      const result = await ipcRenderer.invoke('agents:list');
      return result?.success ? result.agents : [];
    },
    get: async (id: string) => {
      const result = await ipcRenderer.invoke('agents:get', id);
      return result?.success ? result.agent : null;
    },
    create: async (request: { id?: string; name: string; description?: string; systemPrompt?: string; identity?: string; model?: string; agentEngine?: string; icon?: string; skillIds?: string[]; source?: string; presetId?: string }) => {
      const result = await ipcRenderer.invoke('agents:create', request);
      return result?.success ? result.agent : null;
    },
    update: async (id: string, updates: { name?: string; description?: string; systemPrompt?: string; identity?: string; model?: string; agentEngine?: string; icon?: string; skillIds?: string[]; enabled?: boolean }) => {
      const result = await ipcRenderer.invoke('agents:update', id, updates);
      return result?.success ? result.agent : null;
    },
    delete: async (id: string) => {
      const result = await ipcRenderer.invoke('agents:delete', id);
      return result?.success ? result.deleted : false;
    },
    presets: async () => {
      const result = await ipcRenderer.invoke('agents:presets');
      return result?.success ? result.presets : [];
    },
    addPreset: async (presetId: string) => {
      const result = await ipcRenderer.invoke('agents:addPreset', presetId);
      return result?.success ? result.agent : null;
    },
    listTeams: async () => {
      const result = await ipcRenderer.invoke('agents:teams:list');
      return result?.success ? result.teams : [];
    },
    getTeam: async (id: string) => {
      const result = await ipcRenderer.invoke('agents:teams:get', id);
      return result?.success ? result.team : null;
    },
    createTeam: async (request: any) => {
      const result = await ipcRenderer.invoke('agents:teams:create', request);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create agent team');
      }
      return result?.success ? result.team : null;
    },
    updateTeam: async (id: string, updates: any) => {
      const result = await ipcRenderer.invoke('agents:teams:update', id, updates);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to update agent team');
      }
      return result?.success ? result.team : null;
    },
    deleteTeam: async (id: string) => {
      const result = await ipcRenderer.invoke('agents:teams:delete', id);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete agent team');
      }
      return result?.success ? result.deleted : false;
    },
    installDevelopmentTeam: async () => {
      const result = await ipcRenderer.invoke('agents:teams:installDevelopmentTemplate');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to install development team');
      }
      return result?.success ? result.team : null;
    },
  },
  orchestrator: {
    listTemplates: async () => {
      const result = await ipcRenderer.invoke('orchestrator:listTemplates');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list orchestrator templates');
      }
      return result.templates ?? [];
    },
    plan: async (goal: string, context?: string, templateId?: string) => {
      const result = await ipcRenderer.invoke(
        'orchestrator:plan',
        goal,
        context,
        templateId,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create orchestrator plan');
      }
      return result.graph ?? null;
    },
    execute: async (graphId: string) => {
      const result = await ipcRenderer.invoke('orchestrator:execute', graphId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to execute orchestrator graph');
      }
      return {
        graph: result.graph ?? null,
        summary: typeof result.summary === 'string' ? result.summary : '',
      };
    },
    cancel: async (graphId: string) => {
      const result = await ipcRenderer.invoke('orchestrator:cancel', graphId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to cancel orchestrator graph');
      }
      return Boolean(result.cancelled);
    },
    getStatus: async (graphId: string) => {
      const result = await ipcRenderer.invoke('orchestrator:getStatus', graphId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get orchestrator graph status');
      }
      return result.graph ?? null;
    },
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, event: any) => callback(event);
      ipcRenderer.on('orchestrator:event', handler);
      return () => ipcRenderer.removeListener('orchestrator:event', handler);
    },
  },
  research: {
    start: async (query: { query: string; sources: Array<'web' | 'scholar' | 'social'>; maxRounds: number; crossValidate?: boolean }) => {
      const result = await ipcRenderer.invoke('research:start', query);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start research session');
      }
      return result.session ?? null;
    },
    cancel: async (sessionId: string) => {
      const result = await ipcRenderer.invoke('research:cancel', sessionId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to cancel research session');
      }
      return Boolean(result.cancelled);
    },
    getStatus: async (sessionId: string) => {
      const result = await ipcRenderer.invoke('research:getStatus', sessionId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get research session status');
      }
      return result.session ?? null;
    },
    getResult: async (sessionId: string) => {
      const result = await ipcRenderer.invoke('research:getResult', sessionId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get research result');
      }
      return result.result ?? null;
    },
    list: async () => {
      const result = await ipcRenderer.invoke('research:list');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list research sessions');
      }
      return result.sessions ?? [];
    },
    getReport: async (sessionId: string) => {
      const result = await ipcRenderer.invoke('research:getReport', sessionId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get research report');
      }
      return typeof result.report === 'string' ? result.report : null;
    },
    pushToIM: async (sessionId: string, channels: string[]) => {
      const result = await ipcRenderer.invoke(
        'research:pushToIM',
        sessionId,
        channels,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to deliver research report to IM');
      }
      return result.result ?? null;
    },
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, event: any) => callback(event);
      ipcRenderer.on('research:event', handler);
      return () => ipcRenderer.removeListener('research:event', handler);
    },
  },
  knowledge: {
    search: async (
      query: string,
      options?: {
        limit?: number;
        offset?: number;
        source?: 'conversation' | 'research' | 'manual' | 'hot-topic';
        tags?: string[];
        mode?: 'keyword' | 'embedding' | 'hybrid' | 'entity';
      },
    ) => {
      const result = await ipcRenderer.invoke('knowledge:search', query, options);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to search knowledge base');
      }
      return result.results ?? [];
    },
    get: async (documentId: string) => {
      const result = await ipcRenderer.invoke('knowledge:get', documentId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get knowledge document');
      }
      return result.document ?? null;
    },
    list: async (offset?: number, limit?: number) => {
      const result = await ipcRenderer.invoke('knowledge:list', offset, limit);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list knowledge documents');
      }
      return result.documents ?? [];
    },
    delete: async (documentId: string) => {
      const result = await ipcRenderer.invoke('knowledge:delete', documentId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete knowledge document');
      }
      return Boolean(result.deleted);
    },
    add: async (document: {
      id?: string;
      title: string;
      source: 'conversation' | 'research' | 'manual' | 'hot-topic';
      sourceId?: string;
      content: string;
      contentType: 'markdown' | 'text' | 'html' | 'json';
      metadata?: {
        tags?: string[];
        entities?: Array<{ name: string; type: string; relations: Array<{ target: string; type: string }> }>;
        embedding?: number[];
        createdAt?: string;
      };
    }) => {
      const result = await ipcRenderer.invoke('knowledge:add', document);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to add knowledge document');
      }
      return result.document ?? null;
    },
  },
  hotTopics: {
    start: async (sources: Array<{ source: string; enabled: boolean; interval: number; config?: Record<string, unknown> }>) => {
      const result = await ipcRenderer.invoke('hotTopics:start', sources);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start hot topics monitor');
      }
      return {
        active: Boolean(result.active),
        sources: result.sources ?? [],
      };
    },
    stop: async () => {
      const result = await ipcRenderer.invoke('hotTopics:stop');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to stop hot topics monitor');
      }
      return Boolean(result.active);
    },
    getStatus: async () => {
      const result = await ipcRenderer.invoke('hotTopics:getStatus');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get hot topics monitor status');
      }
      return {
        active: Boolean(result.active),
        sources: result.sources ?? [],
      };
    },
    list: async (limit?: number) => {
      const result = await ipcRenderer.invoke('hotTopics:list', limit);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list hot topics');
      }
      return result.topics ?? [];
    },
    get: async (topicId: string) => {
      const result = await ipcRenderer.invoke('hotTopics:get', topicId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get hot topic');
      }
      return result.topic ?? null;
    },
    getDigest: async () => {
      const result = await ipcRenderer.invoke('hotTopics:getDigest');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get hot topics digest');
      }
      return result.digest ?? null;
    },
    startResearch: async (topicId: string) => {
      const result = await ipcRenderer.invoke('hotTopics:startResearch', topicId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start hot topic research');
      }
      return result.result ?? null;
    },
    startWriting: async (topicId: string, style?: string) => {
      const result = await ipcRenderer.invoke('hotTopics:startWriting', topicId, style);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start hot topic writing');
      }
      return result.result ?? null;
    },
    pushToIM: async (topicId: string, channels: string[]) => {
      const result = await ipcRenderer.invoke('hotTopics:pushToIM', topicId, channels);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to push hot topic to IM');
      }
      return result.result ?? null;
    },
    saveToKnowledge: async (topicId: string) => {
      const result = await ipcRenderer.invoke('hotTopics:saveToKnowledge', topicId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save hot topic to knowledge base');
      }
      return result.result ?? null;
    },
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, event: any) => callback(event);
      ipcRenderer.on('hotTopics:event', handler);
      return () => ipcRenderer.removeListener('hotTopics:event', handler);
    },
  },
  frontendStation: {
    listTemplates: async () => {
      const result = await ipcRenderer.invoke('frontendStation:listTemplates');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list frontend station templates');
      }
      return result.templates ?? [];
    },
    createProject: async (options: {
      name: string;
      template: 'vite-react' | 'vite-vue' | 'nextjs' | 'blank';
      path: string;
    }) => {
      const result = await ipcRenderer.invoke('frontendStation:createProject', options);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create frontend station project');
      }
      return result.project ?? null;
    },
    getProjects: async () => {
      const result = await ipcRenderer.invoke('frontendStation:getProjects');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list frontend station projects');
      }
      return result.projects ?? [];
    },
    getProject: async (projectId: string) => {
      const result = await ipcRenderer.invoke('frontendStation:getProject', projectId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get frontend station project');
      }
      return result.project ?? null;
    },
    startServer: async (projectId: string) => {
      const result = await ipcRenderer.invoke('frontendStation:startServer', projectId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start frontend station server');
      }
      return {
        project: result.project ?? null,
        preview: result.preview ?? null,
      };
    },
    stopServer: async (projectId: string) => {
      const result = await ipcRenderer.invoke('frontendStation:stopServer', projectId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to stop frontend station server');
      }
      return result.project ?? null;
    },
    restartServer: async (projectId: string) => {
      const result = await ipcRenderer.invoke('frontendStation:restartServer', projectId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to restart frontend station server');
      }
      return {
        project: result.project ?? null,
        preview: result.preview ?? null,
      };
    },
    getPreview: async (projectId: string) => {
      const result = await ipcRenderer.invoke('frontendStation:getPreview', projectId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get frontend station preview');
      }
      return result.preview ?? null;
    },
    getPreviews: async () => {
      const result = await ipcRenderer.invoke('frontendStation:getPreviews');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list frontend station previews');
      }
      return result.previews ?? [];
    },
    getFileTree: async (projectId: string) => {
      const result = await ipcRenderer.invoke('frontendStation:getFileTree', projectId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to list frontend station files');
      }
      return result.files ?? [];
    },
    openFile: async (projectId: string, filePath: string) => {
      const result = await ipcRenderer.invoke(
        'frontendStation:openFile',
        projectId,
        filePath,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to open frontend station file');
      }
      return result.file ?? null;
    },
    saveFile: async (options: {
      projectId: string;
      filePath: string;
      content: string;
    }) => {
      const result = await ipcRenderer.invoke('frontendStation:saveFile', options);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save frontend station file');
      }
      return result.file ?? null;
    },
    createTerminalSession: async (projectId: string) => {
      const result = await ipcRenderer.invoke(
        'frontendStation:createTerminalSession',
        projectId,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create frontend station terminal session');
      }
      return result.session ?? null;
    },
    getTerminalBuffer: async (sessionId: string) => {
      const result = await ipcRenderer.invoke(
        'frontendStation:getTerminalBuffer',
        sessionId,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get frontend station terminal buffer');
      }
      return typeof result.buffer === 'string' ? result.buffer : '';
    },
    writeTerminal: async (sessionId: string, data: string) => {
      const result = await ipcRenderer.invoke(
        'frontendStation:writeTerminal',
        sessionId,
        data,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to write to frontend station terminal');
      }
      return Boolean(result.written);
    },
    resizeTerminal: async (options: {
      sessionId: string;
      cols: number;
      rows: number;
    }) => {
      const result = await ipcRenderer.invoke(
        'frontendStation:resizeTerminal',
        options,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to resize frontend station terminal');
      }
      return Boolean(result.resized);
    },
    destroyTerminalSession: async (sessionId: string) => {
      const result = await ipcRenderer.invoke(
        'frontendStation:destroyTerminalSession',
        sessionId,
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to destroy frontend station terminal session');
      }
      return Boolean(result.destroyed);
    },
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, event: any) => callback(event);
      ipcRenderer.on('frontendStation:event', handler);
      return () => ipcRenderer.removeListener('frontendStation:event', handler);
    },
  },
  cowork: {
    // Session management
    startSession: (options: { prompt: string; cwd?: string; systemPrompt?: string; activeSkillIds?: string[]; agentId?: string; teamId?: string; imageAttachments?: Array<{ name: string; mimeType: string; base64Data: string }> }) =>
      ipcRenderer.invoke('cowork:session:start', options),
    continueSession: (options: { sessionId: string; prompt: string; systemPrompt?: string; activeSkillIds?: string[]; imageAttachments?: Array<{ name: string; mimeType: string; base64Data: string }> }) =>
      ipcRenderer.invoke('cowork:session:continue', options),
    stopSession: (sessionId: string) =>
      ipcRenderer.invoke('cowork:session:stop', sessionId),
    deleteSession: (sessionId: string) =>
      ipcRenderer.invoke('cowork:session:delete', sessionId),
    deleteSessions: (sessionIds: string[]) =>
      ipcRenderer.invoke('cowork:session:deleteBatch', sessionIds),
    setSessionPinned: (options: { sessionId: string; pinned: boolean }) =>
      ipcRenderer.invoke('cowork:session:pin', options),
    renameSession: (options: { sessionId: string; title: string }) =>
      ipcRenderer.invoke('cowork:session:rename', options),
    getSession: (sessionId: string) =>
      ipcRenderer.invoke('cowork:session:get', sessionId),
    remoteManaged: (sessionId: string) =>
      ipcRenderer.invoke('cowork:session:remoteManaged', sessionId),
    listSessions: (agentId?: string) =>
      ipcRenderer.invoke('cowork:session:list', agentId),
    exportResultImage: (options: { rect: { x: number; y: number; width: number; height: number }; defaultFileName?: string }) =>
      ipcRenderer.invoke('cowork:session:exportResultImage', options),
    captureImageChunk: (options: { rect: { x: number; y: number; width: number; height: number } }) =>
      ipcRenderer.invoke('cowork:session:captureImageChunk', options),
    saveResultImage: (options: { pngBase64: string; defaultFileName?: string }) =>
      ipcRenderer.invoke('cowork:session:saveResultImage', options),
    exportSessionText: (options: { content: string; defaultFileName?: string; fileExtension?: string }) =>
      ipcRenderer.invoke('cowork:session:exportText', options),
    copyToClipboard: (options: { text?: string; imageBase64?: string }) =>
      ipcRenderer.invoke('cowork:clipboard:copy', options),

    // Permission handling
    respondToPermission: (options: { requestId: string; result: any }) =>
      ipcRenderer.invoke('cowork:permission:respond', options),

    // Configuration
    getConfig: () =>
      ipcRenderer.invoke('cowork:config:get'),
    setConfig: (config: {
      workingDirectory?: string;
      executionMode?: 'auto' | 'local' | 'sandbox';
      agentEngine?: 'openclaw' | 'hermes' | 'claude_code' | 'codex' | 'opencode' | 'deepseek_tui';
      openclawConfigSource?: 'agora_model' | 'local_cli';
      claudeCodeConfigSource?: 'agora_model' | 'local_cli';
      codexConfigSource?: 'agora_model' | 'local_cli';
      hermesConfigSource?: 'agora_model' | 'local_cli';
      opencodeConfigSource?: 'agora_model' | 'local_cli';
      opencodePermissionMode?: 'auto' | 'conservative';
      deepseekTuiConfigSource?: 'agora_model' | 'local_cli';
      deepseekTuiPermissionMode?: 'auto' | 'conservative';
      memoryEnabled?: boolean;
      memoryImplicitUpdateEnabled?: boolean;
      memoryLlmJudgeEnabled?: boolean;
      memoryGuardLevel?: 'strict' | 'standard' | 'relaxed';
      memoryUserMemoriesMaxItems?: number;
    }) =>
      ipcRenderer.invoke('cowork:config:set', config),
    listAgentEngines: () =>
      ipcRenderer.invoke('cowork:agentEngines:list'),
    getRuntimeMetricsSummary: (filters: any) =>
      ipcRenderer.invoke(CoworkIpcChannel.RuntimeMetricsSummary, filters),
    listRuntimeCalls: (filters: any) =>
      ipcRenderer.invoke(CoworkIpcChannel.RuntimeMetricsCalls, filters),
    getRuntimeCallDetail: (callId: string) =>
      ipcRenderer.invoke(CoworkIpcChannel.RuntimeMetricsDetail, { callId }),
    ensureStudioAssets: () =>
      ipcRenderer.invoke(CoworkIpcChannel.StudioAssetsEnsure),
    installAgentCli: (appType: 'claude' | 'codex' | 'hermes' | 'openclaw' | 'opencode' | 'deepseek_tui') =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentCliInstall, { appType }),
    listAgentProviders: (appType: 'claude' | 'codex' | 'hermes' | 'openclaw' | 'opencode' | 'deepseek_tui') =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentProvidersList, { appType }),
    saveAgentProvider: (input: {
      appType: 'claude' | 'codex' | 'hermes' | 'openclaw' | 'opencode' | 'deepseek_tui';
      id?: string;
      name: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      settingsConfig?: Record<string, unknown>;
      category?: string | null;
      setCurrent?: boolean;
    }) =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentProvidersSave, input),
    deleteAgentProvider: (input: { appType: 'claude' | 'codex' | 'hermes' | 'openclaw' | 'opencode' | 'deepseek_tui'; id: string }) =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentProvidersDelete, input),
    setCurrentAgentProvider: (input: { appType: 'claude' | 'codex' | 'hermes' | 'openclaw' | 'opencode' | 'deepseek_tui'; id: string }) =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentProvidersSetCurrent, input),
    importLiveAgentProvider: (appType: 'claude' | 'codex' | 'hermes' | 'openclaw' | 'opencode' | 'deepseek_tui') =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentProvidersImportLive, { appType }),
    importLocalAgentConfigToModelSettings: (appType: 'claude' | 'codex' | 'hermes' | 'openclaw' | 'opencode' | 'deepseek_tui') =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentConfigImportLocalToModelSettings, { appType }),
    syncOpenClawGlobalConfig: () =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentConfigSyncOpenClawGlobal),
    syncOpenCodeGlobalConfig: () =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentConfigSyncOpenCodeGlobal),
    syncDeepSeekTuiGlobalConfig: () =>
      ipcRenderer.invoke(CoworkIpcChannel.AgentConfigSyncDeepSeekTuiGlobal),
    onAgentCliInstallProgress: (callback: (progress: any) => void) => {
      const handler = (_event: any, progress: any) => callback(progress);
      ipcRenderer.on(CoworkIpcChannel.AgentCliInstallProgress, handler);
      return () => ipcRenderer.removeListener(CoworkIpcChannel.AgentCliInstallProgress, handler);
    },
    listMemoryEntries: (input: {
      query?: string;
      status?: 'created' | 'stale' | 'deleted' | 'all';
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    }) =>
      ipcRenderer.invoke('cowork:memory:listEntries', input),
    createMemoryEntry: (input: {
      text: string;
      confidence?: number;
      isExplicit?: boolean;
    }) =>
      ipcRenderer.invoke('cowork:memory:createEntry', input),
    updateMemoryEntry: (input: {
      id: string;
      text?: string;
      confidence?: number;
      status?: 'created' | 'stale' | 'deleted';
      isExplicit?: boolean;
    }) =>
      ipcRenderer.invoke('cowork:memory:updateEntry', input),
    deleteMemoryEntry: (input: { id: string }) =>
      ipcRenderer.invoke('cowork:memory:deleteEntry', input),
    getMemoryStats: () =>
      ipcRenderer.invoke('cowork:memory:getStats'),
    readBootstrapFile: (filename: string) =>
      ipcRenderer.invoke('cowork:bootstrap:read', filename),
    writeBootstrapFile: (filename: string, content: string) =>
      ipcRenderer.invoke('cowork:bootstrap:write', filename, content),
    // Stream event listeners
    onStreamMessage: (callback: (data: { sessionId: string; message: any }) => void) => {
      const handler = (_event: any, data: { sessionId: string; message: any }) => callback(data);
      ipcRenderer.on('cowork:stream:message', handler);
      return () => ipcRenderer.removeListener('cowork:stream:message', handler);
    },
    onStreamMessageUpdate: (callback: (data: { sessionId: string; messageId: string; content: string }) => void) => {
      const handler = (_event: any, data: { sessionId: string; messageId: string; content: string }) => callback(data);
      ipcRenderer.on('cowork:stream:messageUpdate', handler);
      return () => ipcRenderer.removeListener('cowork:stream:messageUpdate', handler);
    },
    onStreamFileActivity: (callback: (data: { sessionId: string; activity: CoworkFileActivity }) => void) => {
      const handler = (_event: IpcRendererEvent, data: { sessionId: string; activity: CoworkFileActivity }) => callback(data);
      ipcRenderer.on(CoworkIpcChannel.StreamFileActivity, handler);
      return () => ipcRenderer.removeListener(CoworkIpcChannel.StreamFileActivity, handler);
    },
    onStreamPermission: (callback: (data: { sessionId: string; request: any }) => void) => {
      const handler = (_event: any, data: { sessionId: string; request: any }) => callback(data);
      ipcRenderer.on('cowork:stream:permission', handler);
      return () => ipcRenderer.removeListener('cowork:stream:permission', handler);
    },
    onStreamPermissionDismiss: (callback: (data: { requestId: string }) => void) => {
      const handler = (_event: any, data: { requestId: string }) => callback(data);
      ipcRenderer.on('cowork:stream:permissionDismiss', handler);
      return () => ipcRenderer.removeListener('cowork:stream:permissionDismiss', handler);
    },
    onStreamComplete: (callback: (data: { sessionId: string; claudeSessionId: string | null }) => void) => {
      const handler = (_event: any, data: { sessionId: string; claudeSessionId: string | null }) => callback(data);
      ipcRenderer.on('cowork:stream:complete', handler);
      return () => ipcRenderer.removeListener('cowork:stream:complete', handler);
    },
    onStreamError: (callback: (data: { sessionId: string; error: string }) => void) => {
      const handler = (_event: any, data: { sessionId: string; error: string }) => callback(data);
      ipcRenderer.on('cowork:stream:error', handler);
      return () => ipcRenderer.removeListener('cowork:stream:error', handler);
    },
    onSessionsChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('cowork:sessions:changed', handler);
      return () => ipcRenderer.removeListener('cowork:sessions:changed', handler);
    },
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:selectFile', options),
    selectFiles: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:selectFiles', options),
    saveInlineFile: (options: { dataBase64: string; fileName?: string; mimeType?: string; cwd?: string }) =>
      ipcRenderer.invoke('dialog:saveInlineFile', options),
    readFileAsDataUrl: (filePath: string) =>
      ipcRenderer.invoke('dialog:readFileAsDataUrl', filePath),
    saveLocalImageToDirectory: (options: { sourcePath: string; fileName?: string }) =>
      ipcRenderer.invoke(DialogIpcChannel.SaveLocalImageToDirectory, options),
  },
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  autoLaunch: {
    get: () => ipcRenderer.invoke('app:getAutoLaunch'),
    set: (enabled: boolean) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
  },
  preventSleep: {
    get: () => ipcRenderer.invoke('app:getPreventSleep'),
    set: (enabled: boolean) => ipcRenderer.invoke('app:setPreventSleep', enabled),
  },
  appInfo: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getSystemLocale: () => ipcRenderer.invoke('app:getSystemLocale'),
  },
  appUpdate: {
    download: (url: string) => ipcRenderer.invoke('appUpdate:download', url),
    cancelDownload: () => ipcRenderer.invoke('appUpdate:cancelDownload'),
    install: (filePath: string) => ipcRenderer.invoke('appUpdate:install', filePath),
    onDownloadProgress: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('appUpdate:downloadProgress', handler);
      return () => ipcRenderer.removeListener('appUpdate:downloadProgress', handler);
    },
  },
  log: {
    getPath: () => ipcRenderer.invoke('log:getPath'),
    openFolder: () => ipcRenderer.invoke('log:openFolder'),
    exportZip: () => ipcRenderer.invoke('log:exportZip'),
  },
  im: {
    // Configuration
    getConfig: () => ipcRenderer.invoke('im:config:get'),
    setConfig: (config: any, options?: { syncGateway?: boolean }) => ipcRenderer.invoke('im:config:set', config, options),
    syncConfig: () => ipcRenderer.invoke('im:config:sync'),

    // Gateway control
    startGateway: (platform: Platform) => ipcRenderer.invoke('im:gateway:start', platform),
    stopGateway: (platform: Platform) => ipcRenderer.invoke('im:gateway:stop', platform),
    testGateway: (
      platform: Platform,
      configOverride?: any
    ) => ipcRenderer.invoke('im:gateway:test', platform, configOverride),

    // Status
    getStatus: () => ipcRenderer.invoke('im:status:get'),
    getLocalIp: () => ipcRenderer.invoke('im:getLocalIp') as Promise<string>,
    // OpenClaw config schema
    getOpenClawConfigSchema: () => ipcRenderer.invoke('im:openclaw:config-schema'),


    // Weixin QR login
    weixinQrLoginStart: () => ipcRenderer.invoke('im:weixin:qr-login-start'),
    weixinQrLoginWait: (accountId?: string) => ipcRenderer.invoke('im:weixin:qr-login-wait', accountId),

    // Pairing
    listPairingRequests: (platform: string) => ipcRenderer.invoke('im:pairing:list', platform),
    approvePairingCode: (platform: string, code: string) => ipcRenderer.invoke('im:pairing:approve', platform, code),
    rejectPairingRequest: (platform: string, code: string) => ipcRenderer.invoke('im:pairing:reject', platform, code),

    // DingTalk Multi-Instance
    addDingTalkInstance: (name: string) => ipcRenderer.invoke('im:dingtalk:instance:add', name),
    deleteDingTalkInstance: (instanceId: string) => ipcRenderer.invoke('im:dingtalk:instance:delete', instanceId),
    setDingTalkInstanceConfig: (instanceId: string, config: any, options?: { syncGateway?: boolean }) =>
      ipcRenderer.invoke('im:dingtalk:instance:config:set', instanceId, config, options),

    // QQ Multi-Instance
    addQQInstance: (name: string) => ipcRenderer.invoke('im:qq:instance:add', name),
    deleteQQInstance: (instanceId: string) => ipcRenderer.invoke('im:qq:instance:delete', instanceId),
    setQQInstanceConfig: (instanceId: string, config: any, options?: { syncGateway?: boolean }) =>
      ipcRenderer.invoke('im:qq:instance:config:set', instanceId, config, options),

    // Feishu Multi-Instance
    addFeishuInstance: (name: string, engineKey?: FeishuEngineKeyType) => ipcRenderer.invoke('im:feishu:instance:add', name, engineKey),
    deleteFeishuInstance: (instanceId: string, engineKey?: FeishuEngineKeyType) => ipcRenderer.invoke('im:feishu:instance:delete', instanceId, engineKey),
    setFeishuInstanceConfig: (instanceId: string, config: any, options?: { syncGateway?: boolean; engineKey?: FeishuEngineKeyType }) =>
      ipcRenderer.invoke('im:feishu:instance:config:set', instanceId, config, options),
    detectOpenClawLocalFeishu: () => ipcRenderer.invoke(ImIpcChannel.FeishuDetectOpenClawLocal),
    importOpenClawLocalFeishu: () => ipcRenderer.invoke(ImIpcChannel.FeishuImportOpenClawLocal),
    setFeishuManagementMode: (mode: FeishuManagementModeType) =>
      ipcRenderer.invoke(ImIpcChannel.FeishuSetManagementMode, mode),
    setFeishuRuntimeOwnership: (input: { engineKey: FeishuEngineKeyType; ownership: FeishuRuntimeOwnershipType }) =>
      ipcRenderer.invoke(ImIpcChannel.FeishuSetRuntimeOwnership, input),
    refreshFeishuRuntimeOwnership: (engineKey?: FeishuEngineKeyType) =>
      ipcRenderer.invoke(ImIpcChannel.FeishuRefreshRuntimeOwnership, engineKey),

    // Event listeners
    onStatusChange: (callback: (status: any) => void) => {
      const handler = (_event: any, status: any) => callback(status);
      ipcRenderer.on('im:status:change', handler);
      return () => ipcRenderer.removeListener('im:status:change', handler);
    },
    onMessageReceived: (callback: (message: any) => void) => {
      const handler = (_event: any, message: any) => callback(message);
      ipcRenderer.on('im:message:received', handler);
      return () => ipcRenderer.removeListener('im:message:received', handler);
    },
  },
  scheduledTasks: {
    // Task CRUD
    list: () => ipcRenderer.invoke(ScheduledTaskIpc.List),
    get: (id: string) => ipcRenderer.invoke(ScheduledTaskIpc.Get, id),
    create: (input: any) => ipcRenderer.invoke(ScheduledTaskIpc.Create, input),
    update: (id: string, input: any) => ipcRenderer.invoke(ScheduledTaskIpc.Update, id, input),
    delete: (id: string) => ipcRenderer.invoke(ScheduledTaskIpc.Delete, id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke(ScheduledTaskIpc.Toggle, id, enabled),

    // Execution
    runManually: (id: string) => ipcRenderer.invoke(ScheduledTaskIpc.RunManually, id),
    stop: (id: string) => ipcRenderer.invoke(ScheduledTaskIpc.Stop, id),

    // Run history
    listRuns: (taskId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke(ScheduledTaskIpc.ListRuns, taskId, limit, offset),
    countRuns: (taskId: string) => ipcRenderer.invoke(ScheduledTaskIpc.CountRuns, taskId),
    listAllRuns: (limit?: number, offset?: number) =>
      ipcRenderer.invoke(ScheduledTaskIpc.ListAllRuns, limit, offset),
    resolveSession: (sessionKey: string) =>
      ipcRenderer.invoke(ScheduledTaskIpc.ResolveSession, sessionKey),

    // Delivery channels
    listChannels: () => ipcRenderer.invoke(ScheduledTaskIpc.ListChannels),
    listChannelConversations: (channel: string, accountId?: string) => ipcRenderer.invoke(ScheduledTaskIpc.ListChannelConversations, channel, accountId),

    // Stream event listeners
    onStatusUpdate: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on(ScheduledTaskIpc.StatusUpdate, handler);
      return () => ipcRenderer.removeListener(ScheduledTaskIpc.StatusUpdate, handler);
    },
    onRunUpdate: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on(ScheduledTaskIpc.RunUpdate, handler);
      return () => ipcRenderer.removeListener(ScheduledTaskIpc.RunUpdate, handler);
    },
    onRefresh: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(ScheduledTaskIpc.Refresh, handler);
      return () => ipcRenderer.removeListener(ScheduledTaskIpc.Refresh, handler);
    },
  },
  networkStatus: {
    send: (status: 'online' | 'offline') => ipcRenderer.send('network:status-change', status),
  },
  qwen: {
    // OAuth登录
    oauthLogin: () => ipcRenderer.invoke('qwen:oauth:login'),
    // OAuth刷新token
    oauthRefresh: (refreshToken: string) => ipcRenderer.invoke('qwen:oauth:refresh', refreshToken),
    // OAuth进度监听
    onOAuthProgress: (callback: (message: string) => void) => {
      const handler = (_event: any, message: string) => callback(message);
      ipcRenderer.on('qwen:oauth:progress', handler);
      return () => ipcRenderer.removeListener('qwen:oauth:progress', handler);
    },
  },
  auth: {
    login: (loginUrl?: string) => ipcRenderer.invoke('auth:login', { loginUrl }),
    exchange: (code: string) => ipcRenderer.invoke('auth:exchange', { code }),
    getPendingCallback: () => ipcRenderer.invoke('auth:getPendingCallback'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    getQuota: () => ipcRenderer.invoke('auth:getQuota'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    refreshToken: () => ipcRenderer.invoke('auth:refreshToken'),
    getAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
    getModels: () => ipcRenderer.invoke('auth:getModels'),
    getProfileSummary: () => ipcRenderer.invoke('auth:getProfileSummary'),
    onCallback: (callback: (data: { code: string }) => void) => {
      const handler = (_event: any, data: { code: string }) => callback(data);
      ipcRenderer.on('auth:callback', handler);
      return () => ipcRenderer.removeListener('auth:callback', handler);
    },
    onQuotaChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('auth:quotaChanged', handler);
      return () => ipcRenderer.removeListener('auth:quotaChanged', handler);
    },
  },
  feishu: {
    install: {
      qrcode: (isLark: boolean) =>
        ipcRenderer.invoke('feishu:install:qrcode', { isLark }) as Promise<{
          url: string;
          deviceCode: string;
          interval: number;
          expireIn: number;
        }>,
      poll: (deviceCode: string) =>
        ipcRenderer.invoke('feishu:install:poll', { deviceCode }) as Promise<{
          done: boolean;
          appId?: string;
          appSecret?: string;
          domain?: string;
          error?: string;
        }>,
      verify: (appId: string, appSecret: string) =>
        ipcRenderer.invoke('feishu:install:verify', { appId, appSecret }) as Promise<{
          success: boolean;
          error?: string;
        }>,
    },
  },
  githubCopilot: {
    requestDeviceCode: () =>
      ipcRenderer.invoke('github-copilot:request-device-code') as Promise<{
        userCode: string;
        verificationUri: string;
        deviceCode: string;
        interval: number;
        expiresIn: number;
      }>,
    pollForToken: (deviceCode: string, interval: number, expiresIn: number) =>
      ipcRenderer.invoke('github-copilot:poll-for-token', { deviceCode, interval, expiresIn }) as Promise<{
        success: boolean;
        token?: string;
        githubUser?: string;
        baseUrl?: string;
        error?: string;
      }>,
    cancelPolling: () => ipcRenderer.invoke('github-copilot:cancel-polling') as Promise<void>,
    signOut: () => ipcRenderer.invoke('github-copilot:sign-out') as Promise<void>,
    refreshToken: () =>
      ipcRenderer.invoke('github-copilot:refresh-token') as Promise<{
        success: boolean;
        token?: string;
        baseUrl?: string;
        error?: string;
      }>,
    onTokenUpdated: (callback: (data: { token: string; baseUrl: string }) => void) => {
      const handler = (_event: unknown, data: { token: string; baseUrl: string }) => callback(data);
      ipcRenderer.on('github-copilot:token-updated', handler);
      return () => ipcRenderer.removeListener('github-copilot:token-updated', handler);
    },
  },

  };
}
