import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FrontendStationRuntime } from './FrontendStationRuntime';
import { PreviewPanel } from './PreviewPanel';
import type { DevProject } from './types';

class FakeDevServerManager extends EventEmitter {
  private readonly projects = new Map<string, DevProject>();

  createProject = vi.fn(async (options: {
    name: string;
    template: 'blank';
    path: string;
  }) => {
    const project: DevProject = {
      id: 'project-1',
      name: options.name,
      template: options.template,
      path: options.path,
      port: 5173,
      status: 'stopped',
      createdAt: '2026-06-07T00:00:00.000Z',
    };
    this.projects.set(project.id, project);
    return project;
  });

  startServer = vi.fn(async (projectId: string) => {
    const project = this.projects.get(projectId);
    if (project) {
      project.status = 'running';
    }
    this.emit('server-ready', projectId, 'http://127.0.0.1:5173');
  });

  stopServer = vi.fn(async (projectId: string) => {
    const project = this.projects.get(projectId);
    if (project) {
      project.status = 'stopped';
    }
    this.emit('server-stopped', projectId);
  });

  restartServer = vi.fn(async (projectId: string) => {
    await this.stopServer(projectId);
    await this.startServer(projectId);
  });

  getProjects = vi.fn(() => Array.from(this.projects.values()));
  getProject = vi.fn((projectId: string) => this.projects.get(projectId));
}

describe('FrontendStationRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates projects and emits lifecycle events while synchronizing previews', async () => {
    const templateManager = {
      listTemplates: vi.fn(() => [
        {
          id: 'blank',
          name: 'Blank Project',
          description: 'Empty directory with a basic package.json',
          command: '',
          args: [],
        },
      ]),
      scaffoldProject: vi.fn(async () => {}),
    };
    const devServerManager = new FakeDevServerManager();
    const runtime = new FrontendStationRuntime({
      templateManager: templateManager as never,
      devServerManager: devServerManager as never,
      previewPanel: new PreviewPanel(),
    });
    const events: string[] = [];

    runtime.on('frontend:event', (event) => {
      events.push(event.type);
    });

    const project = await runtime.createProject({
      name: 'Agora Demo',
      template: 'blank',
      path: '/tmp/agora-demo',
    });

    expect(templateManager.scaffoldProject).toHaveBeenCalledWith(
      'blank',
      'Agora Demo',
      '/tmp/agora-demo',
    );
    expect(project).toMatchObject({
      id: 'project-1',
      name: 'Agora Demo',
      template: 'blank',
    });
    expect(runtime.listTemplates()).toEqual([
      expect.objectContaining({ id: 'blank' }),
    ]);

    await expect(runtime.startServer('project-1')).resolves.toMatchObject({
      project: expect.objectContaining({
        id: 'project-1',
        status: 'running',
      }),
      preview: {
        projectId: 'project-1',
        url: 'http://127.0.0.1:5173',
        active: true,
      },
    });
    expect(runtime.getPreview('project-1')).toEqual({
      projectId: 'project-1',
      url: 'http://127.0.0.1:5173',
      active: true,
    });

    await expect(runtime.stopServer('project-1')).resolves.toMatchObject({
      project: expect.objectContaining({
        id: 'project-1',
        status: 'stopped',
      }),
    });
    expect(runtime.getPreview('project-1')).toBeUndefined();
    expect(events).toEqual([
      'project-created',
      'server-ready',
      'server-stopped',
    ]);
  });

  it('exposes file tree, editor file metadata, and terminal session helpers', async () => {
    const templateManager = {
      listTemplates: vi.fn(() => []),
      scaffoldProject: vi.fn(async () => {}),
    };
    const codeEditor = {
      listProjectFiles: vi.fn(async () => [
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
      ]),
      openFile: vi.fn(async () => ({
        path: '/tmp/agora-demo/src/App.tsx',
        language: 'typescript',
        content: 'export const App = () => null;\n',
        dirty: false,
      })),
      saveFile: vi.fn(async (_projectId: string, filePath: string, content: string) => ({
        path: filePath,
        language: 'typescript',
        content,
        dirty: false,
      })),
    };
    const terminalManager = new EventEmitter() as EventEmitter & {
      createSession: ReturnType<typeof vi.fn>;
      getBuffer: ReturnType<typeof vi.fn>;
      write: ReturnType<typeof vi.fn>;
      resize: ReturnType<typeof vi.fn>;
      getSession: ReturnType<typeof vi.fn>;
      destroySession: ReturnType<typeof vi.fn>;
    };
    terminalManager.createSession = vi.fn(() => ({
      sessionId: 'session-1',
      projectId: 'project-1',
      cwd: '/tmp/agora-demo',
      shell: '/bin/zsh',
      status: 'running' as const,
      createdAt: '2026-06-07T00:00:00.000Z',
    }));
    terminalManager.getBuffer = vi.fn(() => 'npm run dev\r\n');
    terminalManager.write = vi.fn();
    terminalManager.resize = vi.fn();
    terminalManager.getSession = vi.fn(() => ({
      sessionId: 'session-1',
    }));
    terminalManager.destroySession = vi.fn();

    const runtime = new FrontendStationRuntime({
      templateManager: templateManager as never,
      devServerManager: new FakeDevServerManager() as never,
      previewPanel: new PreviewPanel(),
      codeEditor: codeEditor as never,
      terminalManager: terminalManager as never,
    });

    await runtime.createProject({
      name: 'Agora Demo',
      template: 'blank',
      path: '/tmp/agora-demo',
    });

    await expect(runtime.getFileTree('project-1')).resolves.toEqual([
      expect.objectContaining({
        relativePath: 'src',
      }),
    ]);
    await expect(
      runtime.openFile('project-1', '/tmp/agora-demo/src/App.tsx'),
    ).resolves.toMatchObject({
      path: '/tmp/agora-demo/src/App.tsx',
      relativePath: 'src/App.tsx',
      language: 'typescript',
    });
    await expect(
      runtime.saveFile(
        'project-1',
        '/tmp/agora-demo/src/App.tsx',
        'export const App = () => <main />;\n',
      ),
    ).resolves.toMatchObject({
      relativePath: 'src/App.tsx',
      content: 'export const App = () => <main />;\n',
    });

    expect(runtime.createTerminalSession('project-1')).toMatchObject({
      sessionId: 'session-1',
      projectId: 'project-1',
    });
    expect(runtime.getTerminalBuffer('session-1')).toBe('npm run dev\r\n');

    runtime.writeTerminal('session-1', 'npm run dev\n');
    runtime.resizeTerminal('session-1', 100, 28);
    expect(terminalManager.write).toHaveBeenCalledWith('session-1', 'npm run dev\n');
    expect(terminalManager.resize).toHaveBeenCalledWith('session-1', 100, 28);
    expect(runtime.destroyTerminalSession('session-1')).toBe(true);
    expect(terminalManager.destroySession).toHaveBeenCalledWith('session-1');
  });
});
