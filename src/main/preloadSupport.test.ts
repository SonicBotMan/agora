import { describe, expect, it, vi } from 'vitest';

import { IpcChannel as ScheduledTaskIpc } from '../scheduled-task/constants';
import { createElectronPreloadApi } from './preloadSupport';

function createMockIpcRenderer() {
  const listeners = new Map<string, (...args: unknown[]) => void>();

  return {
    listeners,
    ipcRenderer: {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
        listeners.set(channel, handler);
      }),
      removeListener: vi.fn(),
    },
  };
}

describe('preloadSupport', () => {
  it('builds the preload API with runtime platform/arch values and invoke wrappers', async () => {
    const { ipcRenderer } = createMockIpcRenderer();
    vi.mocked(ipcRenderer.invoke).mockResolvedValue('dark');

    const api = createElectronPreloadApi(ipcRenderer as never, {
      platform: 'darwin',
      arch: 'arm64',
    });

    expect(api.platform).toBe('darwin');
    expect(api.arch).toBe('arm64');
    await expect(api.store.get('theme')).resolves.toBe('dark');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('store:get', 'theme');
  });

  it('subscribes and unsubscribes bridge sync events with payload mapping', () => {
    const { ipcRenderer, listeners } = createMockIpcRenderer();
    const callback = vi.fn();
    const api = createElectronPreloadApi(ipcRenderer as never);

    const dispose = api.mcp.onBridgeSyncDone(callback);

    expect(ipcRenderer.on).toHaveBeenCalledWith(
      'mcp:bridge:syncDone',
      expect.any(Function),
    );
    listeners.get('mcp:bridge:syncDone')?.({}, { tools: 3, error: 'warn' });
    expect(callback).toHaveBeenCalledWith({ tools: 3, error: 'warn' });

    dispose();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'mcp:bridge:syncDone',
      expect.any(Function),
    );
  });

  it('supports dynamic stream channels and generic ipcRenderer event wrappers', () => {
    const { ipcRenderer, listeners } = createMockIpcRenderer();
    const streamCallback = vi.fn();
    const genericCallback = vi.fn();
    const api = createElectronPreloadApi(ipcRenderer as never);

    const removeStream = api.api.onStreamData('req-1', streamCallback);
    const removeGeneric = api.ipcRenderer.on('custom:event', genericCallback);

    listeners.get('api:stream:req-1:data')?.({}, 'chunk-1');
    expect(streamCallback).toHaveBeenCalledWith('chunk-1');

    listeners.get('custom:event')?.({}, 'first', 'second');
    expect(genericCallback).toHaveBeenCalledWith('first', 'second');

    removeStream();
    removeGeneric();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'api:stream:req-1:data',
      expect.any(Function),
    );
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'custom:event',
      expect.any(Function),
    );
  });

  it('maps orchestrator invoke/event helpers to the expected IPC channels', async () => {
    const { ipcRenderer, listeners } = createMockIpcRenderer();
    const api = createElectronPreloadApi(ipcRenderer as never);
    const eventCallback = vi.fn();

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      graph: { id: 'graph-1' },
    });
    await expect(
      api.orchestrator.plan('Build release notes', 'project context', 'plan-design'),
    ).resolves.toEqual({ id: 'graph-1' });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'orchestrator:plan',
      'Build release notes',
      'project context',
      'plan-design',
    );

    const dispose = api.orchestrator.onEvent(eventCallback);
    listeners.get('orchestrator:event')?.({}, { type: 'plan:complete' });
    expect(eventCallback).toHaveBeenCalledWith({ type: 'plan:complete' });

    dispose();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'orchestrator:event',
      expect.any(Function),
    );
  });

  it('maps research and knowledge helpers to the expected IPC channels', async () => {
    const { ipcRenderer, listeners } = createMockIpcRenderer();
    const api = createElectronPreloadApi(ipcRenderer as never);
    const eventCallback = vi.fn();

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      session: { id: 'research-1' },
    });
    await expect(
      api.research.start({
        query: 'agora architecture rewrite',
        sources: ['web'],
        maxRounds: 1,
      }),
    ).resolves.toEqual({ id: 'research-1' });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('research:start', {
      query: 'agora architecture rewrite',
      sources: ['web'],
      maxRounds: 1,
    });

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      result: {
        sessionId: 'research-1',
        success: true,
      },
    });
    await expect(
      api.research.pushToIM('research-1', ['feishu']),
    ).resolves.toEqual({
      sessionId: 'research-1',
      success: true,
    });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'research:pushToIM',
      'research-1',
      ['feishu'],
    );

    const disposeResearch = api.research.onEvent(eventCallback);
    listeners.get('research:event')?.({}, { type: 'session:completed' });
    expect(eventCallback).toHaveBeenCalledWith({ type: 'session:completed' });

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      results: [{ document: { id: 'doc-1' } }],
    });
    await expect(
      api.knowledge.search('agora', { mode: 'hybrid', limit: 5 }),
    ).resolves.toEqual([{ document: { id: 'doc-1' } }]);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'knowledge:search',
      'agora',
      { mode: 'hybrid', limit: 5 },
    );

    disposeResearch();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'research:event',
      expect.any(Function),
    );
  });

  it('maps hot topics helpers to the expected IPC channels', async () => {
    const { ipcRenderer, listeners } = createMockIpcRenderer();
    const api = createElectronPreloadApi(ipcRenderer as never);
    const eventCallback = vi.fn();

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      active: true,
      sources: [{ source: 'hacker-news', enabled: true, interval: 60 }],
    });
    await expect(
      api.hotTopics.start([
        { source: 'hacker-news', enabled: true, interval: 60 },
      ]),
    ).resolves.toEqual({
      active: true,
      sources: [{ source: 'hacker-news', enabled: true, interval: 60 }],
    });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('hotTopics:start', [
      { source: 'hacker-news', enabled: true, interval: 60 },
    ]);

    const dispose = api.hotTopics.onEvent(eventCallback);
    listeners.get('hotTopics:event')?.({}, { type: 'digest-ready' });
    expect(eventCallback).toHaveBeenCalledWith({ type: 'digest-ready' });

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      digest: { date: '2026-06-07' },
    });
    await expect(api.hotTopics.getDigest()).resolves.toEqual({
      date: '2026-06-07',
    });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('hotTopics:getDigest');

    dispose();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'hotTopics:event',
      expect.any(Function),
    );
  });

  it('maps frontend station helpers to the expected IPC channels', async () => {
    const { ipcRenderer, listeners } = createMockIpcRenderer();
    const api = createElectronPreloadApi(ipcRenderer as never);
    const eventCallback = vi.fn();

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      templates: [{ id: 'blank' }],
    });
    await expect(api.frontendStation.listTemplates()).resolves.toEqual([
      { id: 'blank' },
    ]);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:listTemplates',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      project: { id: 'project-1' },
      preview: { projectId: 'project-1', url: 'http://127.0.0.1:5173' },
    });
    await expect(api.frontendStation.startServer('project-1')).resolves.toEqual({
      project: { id: 'project-1' },
      preview: { projectId: 'project-1', url: 'http://127.0.0.1:5173' },
    });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:startServer',
      'project-1',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      files: [
        {
          name: 'src',
          path: '/tmp/agora-demo/src',
          relativePath: 'src',
          type: 'directory',
          children: [],
        },
      ],
    });
    await expect(api.frontendStation.getFileTree('project-1')).resolves.toEqual([
      {
        name: 'src',
        path: '/tmp/agora-demo/src',
        relativePath: 'src',
        type: 'directory',
        children: [],
      },
    ]);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:getFileTree',
      'project-1',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      file: {
        path: '/tmp/agora-demo/src/App.tsx',
        relativePath: 'src/App.tsx',
        language: 'typescript',
        content: 'export const App = () => null;\n',
        dirty: false,
      },
    });
    await expect(
      api.frontendStation.openFile('project-1', '/tmp/agora-demo/src/App.tsx'),
    ).resolves.toEqual({
      path: '/tmp/agora-demo/src/App.tsx',
      relativePath: 'src/App.tsx',
      language: 'typescript',
      content: 'export const App = () => null;\n',
      dirty: false,
    });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:openFile',
      'project-1',
      '/tmp/agora-demo/src/App.tsx',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      file: {
        path: '/tmp/agora-demo/src/App.tsx',
        relativePath: 'src/App.tsx',
        language: 'typescript',
        content: 'export const App = () => <main />;\n',
        dirty: false,
      },
    });
    await expect(api.frontendStation.saveFile({
      projectId: 'project-1',
      filePath: '/tmp/agora-demo/src/App.tsx',
      content: 'export const App = () => <main />;\n',
    })).resolves.toEqual({
      path: '/tmp/agora-demo/src/App.tsx',
      relativePath: 'src/App.tsx',
      language: 'typescript',
      content: 'export const App = () => <main />;\n',
      dirty: false,
    });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:saveFile',
      {
        projectId: 'project-1',
        filePath: '/tmp/agora-demo/src/App.tsx',
        content: 'export const App = () => <main />;\n',
      },
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      session: { sessionId: 'session-1', projectId: 'project-1' },
    });
    await expect(
      api.frontendStation.createTerminalSession('project-1'),
    ).resolves.toEqual({ sessionId: 'session-1', projectId: 'project-1' });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:createTerminalSession',
      'project-1',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      buffer: 'npm run dev\r\n',
    });
    await expect(
      api.frontendStation.getTerminalBuffer('session-1'),
    ).resolves.toBe('npm run dev\r\n');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:getTerminalBuffer',
      'session-1',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      written: true,
    });
    await expect(
      api.frontendStation.writeTerminal('session-1', 'npm run dev\n'),
    ).resolves.toBe(true);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:writeTerminal',
      'session-1',
      'npm run dev\n',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      resized: true,
    });
    await expect(api.frontendStation.resizeTerminal({
      sessionId: 'session-1',
      cols: 100,
      rows: 28,
    })).resolves.toBe(true);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:resizeTerminal',
      {
        sessionId: 'session-1',
        cols: 100,
        rows: 28,
      },
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      destroyed: true,
    });
    await expect(
      api.frontendStation.destroyTerminalSession('session-1'),
    ).resolves.toBe(true);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'frontendStation:destroyTerminalSession',
      'session-1',
    );

    const dispose = api.frontendStation.onEvent(eventCallback);
    listeners.get('frontendStation:event')?.({}, { type: 'server-ready' });
    expect(eventCallback).toHaveBeenCalledWith({ type: 'server-ready' });

    dispose();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'frontendStation:event',
      expect.any(Function),
    );
  });

  it('surfaces agent team creation/update/delete failures and returns successful payloads', async () => {
    const { ipcRenderer } = createMockIpcRenderer();
    const api = createElectronPreloadApi(ipcRenderer as never);

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: true,
      team: { id: 'team-1' },
    });
    await expect(api.agents.createTeam({ name: 'core' })).resolves.toEqual({
      id: 'team-1',
    });

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: false,
      error: 'failed',
    });
    await expect(api.agents.updateTeam('team-1', { name: 'next' })).rejects.toThrow(
      'failed',
    );

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce({
      success: false,
    });
    await expect(api.agents.deleteTeam('team-1')).rejects.toThrow(
      'Failed to delete agent team',
    );
  });

  it('wires void event subscriptions that ignore the electron event payload', () => {
    const { ipcRenderer, listeners } = createMockIpcRenderer();
    const callback = vi.fn();
    const api = createElectronPreloadApi(ipcRenderer as never);

    api.scheduledTasks.onRefresh(callback);
    listeners.get(ScheduledTaskIpc.Refresh)?.({});

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
