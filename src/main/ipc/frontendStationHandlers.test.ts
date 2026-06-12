import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const frontendStationHandlersTestState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const handle = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });
  const send = vi.fn();
  const getAllWindows = vi.fn(() => [
    {
      isDestroyed: () => false,
      webContents: {
        send,
      },
    },
  ]);

  return {
    handlers,
    handle,
    send,
    getAllWindows,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: frontendStationHandlersTestState.handle,
  },
  BrowserWindow: {
    getAllWindows: frontendStationHandlersTestState.getAllWindows,
  },
}));

import { registerFrontendStationHandlers } from './frontendStationHandlers';

class FakeFrontendStationRuntime extends EventEmitter {
  private readonly project = {
    id: 'project-1',
    name: 'Agora Demo',
    template: 'blank' as const,
    path: '/tmp/agora-demo',
    port: 5173,
    status: 'running' as const,
    createdAt: '2026-06-07T00:00:00.000Z',
  };

  listTemplates = vi.fn(() => [
    {
      id: 'blank',
      name: 'Blank Project',
      description: 'Empty directory with a basic package.json',
      command: '',
      args: [],
    },
  ]);

  createProject = vi.fn(async () => {
    this.emit('frontend:event', {
      type: 'project-created',
      project: this.project,
    });
    return this.project;
  });

  getProjects = vi.fn(() => [this.project]);
  getProject = vi.fn(() => this.project);
  startServer = vi.fn(async () => {
    this.emit('frontend:event', {
      type: 'server-ready',
      projectId: 'project-1',
      url: 'http://127.0.0.1:5173',
    });
    return {
      project: this.project,
      preview: {
        projectId: 'project-1',
        url: 'http://127.0.0.1:5173',
        active: true,
      },
    };
  });
  stopServer = vi.fn(async () => ({
    project: {
      ...this.project,
      status: 'stopped' as const,
    },
  }));
  restartServer = vi.fn(async () => ({
    project: this.project,
    preview: {
      projectId: 'project-1',
      url: 'http://127.0.0.1:5173',
      active: true,
    },
  }));
  getPreview = vi.fn(() => ({
    projectId: 'project-1',
    url: 'http://127.0.0.1:5173',
    active: true,
  }));
  getPreviews = vi.fn(() => [{
    projectId: 'project-1',
    url: 'http://127.0.0.1:5173',
    active: true,
  }]);
  getFileTree = vi.fn(async () => [
    {
      name: 'src',
      path: '/tmp/agora-demo/src',
      relativePath: 'src',
      type: 'directory' as const,
      children: [
        {
          name: 'App.tsx',
          path: '/tmp/agora-demo/src/App.tsx',
          relativePath: 'src/App.tsx',
          type: 'file' as const,
        },
      ],
    },
  ]);
  openFile = vi.fn(async () => ({
    path: '/tmp/agora-demo/src/App.tsx',
    relativePath: 'src/App.tsx',
    language: 'typescript',
    content: 'export const App = () => null;\n',
    dirty: false,
  }));
  saveFile = vi.fn(async (_projectId: string, filePath: string, content: string) => ({
    path: filePath,
    relativePath: 'src/App.tsx',
    language: 'typescript',
    content,
    dirty: false,
  }));
  createTerminalSession = vi.fn(() => ({
    sessionId: 'session-1',
    projectId: 'project-1',
    cwd: '/tmp/agora-demo',
    shell: '/bin/zsh',
    status: 'running' as const,
    createdAt: '2026-06-07T00:00:00.000Z',
  }));
  getTerminalBuffer = vi.fn(() => 'npm run dev\r\n');
  writeTerminal = vi.fn();
  resizeTerminal = vi.fn();
  destroyTerminalSession = vi.fn(() => true);
}

describe('frontendStationHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    frontendStationHandlersTestState.handlers.clear();
  });

  it('creates projects and forwards frontend station events to renderer windows', async () => {
    const runtime = new FakeFrontendStationRuntime();

    registerFrontendStationHandlers({
      getFrontendStationRuntime: () => runtime as never,
    });

    const listTemplates = frontendStationHandlersTestState.handlers.get(
      'frontendStation:listTemplates',
    );
    const createProject = frontendStationHandlersTestState.handlers.get(
      'frontendStation:createProject',
    );

    await expect(listTemplates?.()).resolves.toMatchObject({
      success: true,
      templates: [expect.objectContaining({ id: 'blank' })],
    });

    await expect(
      createProject?.({}, {
        name: 'Agora Demo',
        template: 'blank',
        path: '/tmp/agora-demo',
      }),
    ).resolves.toMatchObject({
      success: true,
      project: expect.objectContaining({
        id: 'project-1',
        name: 'Agora Demo',
      }),
    });

    expect(frontendStationHandlersTestState.send).toHaveBeenCalledWith(
      'frontendStation:event',
      expect.objectContaining({
        type: 'project-created',
      }),
    );
  });

  it('exposes project, server, and preview handlers through the shared runtime', async () => {
    const runtime = new FakeFrontendStationRuntime();

    registerFrontendStationHandlers({
      getFrontendStationRuntime: () => runtime as never,
    });

    const getProjects = frontendStationHandlersTestState.handlers.get(
      'frontendStation:getProjects',
    );
    const getProject = frontendStationHandlersTestState.handlers.get(
      'frontendStation:getProject',
    );
    const startServer = frontendStationHandlersTestState.handlers.get(
      'frontendStation:startServer',
    );
    const stopServer = frontendStationHandlersTestState.handlers.get(
      'frontendStation:stopServer',
    );
    const restartServer = frontendStationHandlersTestState.handlers.get(
      'frontendStation:restartServer',
    );
    const getPreview = frontendStationHandlersTestState.handlers.get(
      'frontendStation:getPreview',
    );
    const getPreviews = frontendStationHandlersTestState.handlers.get(
      'frontendStation:getPreviews',
    );
    const getFileTree = frontendStationHandlersTestState.handlers.get(
      'frontendStation:getFileTree',
    );
    const openFile = frontendStationHandlersTestState.handlers.get(
      'frontendStation:openFile',
    );
    const saveFile = frontendStationHandlersTestState.handlers.get(
      'frontendStation:saveFile',
    );
    const createTerminalSession = frontendStationHandlersTestState.handlers.get(
      'frontendStation:createTerminalSession',
    );
    const getTerminalBuffer = frontendStationHandlersTestState.handlers.get(
      'frontendStation:getTerminalBuffer',
    );
    const writeTerminal = frontendStationHandlersTestState.handlers.get(
      'frontendStation:writeTerminal',
    );
    const resizeTerminal = frontendStationHandlersTestState.handlers.get(
      'frontendStation:resizeTerminal',
    );
    const destroyTerminalSession = frontendStationHandlersTestState.handlers.get(
      'frontendStation:destroyTerminalSession',
    );

    await expect(getProjects?.()).resolves.toMatchObject({
      success: true,
      projects: [expect.objectContaining({ id: 'project-1' })],
    });
    await expect(getProject?.({}, 'project-1')).resolves.toMatchObject({
      success: true,
      project: expect.objectContaining({ id: 'project-1' }),
    });
    await expect(startServer?.({}, 'project-1')).resolves.toMatchObject({
      success: true,
      project: expect.objectContaining({ id: 'project-1' }),
      preview: expect.objectContaining({ url: 'http://127.0.0.1:5173' }),
    });
    await expect(stopServer?.({}, 'project-1')).resolves.toMatchObject({
      success: true,
      project: expect.objectContaining({ status: 'stopped' }),
    });
    await expect(restartServer?.({}, 'project-1')).resolves.toMatchObject({
      success: true,
      preview: expect.objectContaining({ projectId: 'project-1' }),
    });
    await expect(getPreview?.({}, 'project-1')).resolves.toMatchObject({
      success: true,
      preview: expect.objectContaining({ projectId: 'project-1' }),
    });
    await expect(getPreviews?.()).resolves.toMatchObject({
      success: true,
      previews: [expect.objectContaining({ projectId: 'project-1' })],
    });
    await expect(getFileTree?.({}, 'project-1')).resolves.toMatchObject({
      success: true,
      files: [
        expect.objectContaining({
          relativePath: 'src',
          type: 'directory',
        }),
      ],
    });
    await expect(
      openFile?.({}, 'project-1', '/tmp/agora-demo/src/App.tsx'),
    ).resolves.toMatchObject({
      success: true,
      file: expect.objectContaining({
        relativePath: 'src/App.tsx',
        language: 'typescript',
      }),
    });
    await expect(
      saveFile?.({}, {
        projectId: 'project-1',
        filePath: '/tmp/agora-demo/src/App.tsx',
        content: 'export const App = () => <main />;\n',
      }),
    ).resolves.toMatchObject({
      success: true,
      file: expect.objectContaining({
        content: 'export const App = () => <main />;\n',
      }),
    });
    await expect(createTerminalSession?.({}, 'project-1')).resolves.toMatchObject({
      success: true,
      session: expect.objectContaining({
        sessionId: 'session-1',
      }),
    });
    await expect(getTerminalBuffer?.({}, 'session-1')).resolves.toMatchObject({
      success: true,
      buffer: 'npm run dev\r\n',
    });
    await expect(
      writeTerminal?.({}, 'session-1', 'npm run dev\n'),
    ).resolves.toEqual({
      success: true,
      written: true,
    });
    await expect(
      resizeTerminal?.({}, {
        sessionId: 'session-1',
        cols: 100,
        rows: 28,
      }),
    ).resolves.toEqual({
      success: true,
      resized: true,
    });
    await expect(
      destroyTerminalSession?.({}, 'session-1'),
    ).resolves.toEqual({
      success: true,
      destroyed: true,
    });
  });
});
