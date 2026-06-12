import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { frontendStationService } from './frontendStation';

function createFrontendStationApi() {
  return {
    listTemplates: vi.fn(),
    createProject: vi.fn(),
    getProjects: vi.fn(),
    getProject: vi.fn(),
    startServer: vi.fn(),
    stopServer: vi.fn(),
    restartServer: vi.fn(),
    getPreview: vi.fn(),
    getPreviews: vi.fn(),
    getFileTree: vi.fn(),
    openFile: vi.fn(),
    saveFile: vi.fn(),
    createTerminalSession: vi.fn(),
    getTerminalBuffer: vi.fn(),
    writeTerminal: vi.fn(),
    resizeTerminal: vi.fn(),
    destroyTerminalSession: vi.fn(),
    onEvent: vi.fn(() => vi.fn()),
  };
}

describe('frontendStationService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('delegates successful calls to the preload API', async () => {
    const frontendStation = createFrontendStationApi();
    frontendStation.listTemplates.mockResolvedValue([
      { id: 'blank', name: 'Blank Project' },
    ]);
    frontendStation.startServer.mockResolvedValue({
      project: { id: 'project-1', status: 'running' },
      preview: { projectId: 'project-1', url: 'http://127.0.0.1:5173' },
    });
    frontendStation.openFile.mockResolvedValue({
      path: '/tmp/agora-demo/src/App.tsx',
      relativePath: 'src/App.tsx',
      language: 'typescript',
      content: 'export const App = () => null;\n',
      dirty: false,
    });
    frontendStation.createTerminalSession.mockResolvedValue({
      sessionId: 'session-1',
      projectId: 'project-1',
      cwd: '/tmp/agora-demo',
      shell: '/bin/zsh',
      status: 'running',
      createdAt: '2026-06-07T00:00:00.000Z',
    });
    frontendStation.writeTerminal.mockResolvedValue(true);
    const unsubscribe = vi.fn();
    frontendStation.onEvent.mockReturnValue(unsubscribe);

    vi.stubGlobal('window', {
      electron: {
        frontendStation,
      },
    });

    await expect(frontendStationService.listTemplates()).resolves.toEqual([
      { id: 'blank', name: 'Blank Project' },
    ]);
    await expect(frontendStationService.startServer('project-1')).resolves.toEqual({
      project: { id: 'project-1', status: 'running' },
      preview: { projectId: 'project-1', url: 'http://127.0.0.1:5173' },
    });
    await expect(
      frontendStationService.openFile('project-1', '/tmp/agora-demo/src/App.tsx'),
    ).resolves.toEqual({
      path: '/tmp/agora-demo/src/App.tsx',
      relativePath: 'src/App.tsx',
      language: 'typescript',
      content: 'export const App = () => null;\n',
      dirty: false,
    });
    await expect(
      frontendStationService.createTerminalSession('project-1'),
    ).resolves.toEqual({
      sessionId: 'session-1',
      projectId: 'project-1',
      cwd: '/tmp/agora-demo',
      shell: '/bin/zsh',
      status: 'running',
      createdAt: '2026-06-07T00:00:00.000Z',
    });
    await expect(
      frontendStationService.writeTerminal('session-1', 'npm run dev\n'),
    ).resolves.toBe(true);

    const handler = vi.fn();
    expect(frontendStationService.onEvent(handler)).toBe(unsubscribe);
    expect(frontendStation.startServer).toHaveBeenCalledWith('project-1');
    expect(frontendStation.openFile).toHaveBeenCalledWith(
      'project-1',
      '/tmp/agora-demo/src/App.tsx',
    );
    expect(frontendStation.createTerminalSession).toHaveBeenCalledWith('project-1');
    expect(frontendStation.writeTerminal).toHaveBeenCalledWith(
      'session-1',
      'npm run dev\n',
    );
    expect(frontendStation.onEvent).toHaveBeenCalledWith(handler);
  });

  test('returns safe fallbacks when the preload API throws', async () => {
    const frontendStation = createFrontendStationApi();
    frontendStation.getProjects.mockRejectedValue(new Error('boom'));
    frontendStation.createProject.mockRejectedValue(new Error('boom'));
    frontendStation.restartServer.mockRejectedValue(new Error('boom'));
    frontendStation.getPreview.mockRejectedValue(new Error('boom'));
    frontendStation.getFileTree.mockRejectedValue(new Error('boom'));
    frontendStation.getTerminalBuffer.mockRejectedValue(new Error('boom'));
    frontendStation.resizeTerminal.mockRejectedValue(new Error('boom'));
    frontendStation.destroyTerminalSession.mockRejectedValue(new Error('boom'));

    vi.stubGlobal('window', {
      electron: {
        frontendStation,
      },
    });

    await expect(frontendStationService.getProjects()).resolves.toEqual([]);
    await expect(frontendStationService.createProject({
      name: 'Demo',
      template: 'blank',
      path: '/tmp/demo',
    })).resolves.toBeNull();
    await expect(frontendStationService.restartServer('project-1')).resolves.toBeNull();
    await expect(frontendStationService.getPreview('project-1')).resolves.toBeNull();
    await expect(frontendStationService.getFileTree('project-1')).resolves.toEqual([]);
    await expect(frontendStationService.getTerminalBuffer('session-1')).resolves.toBe('');
    await expect(frontendStationService.resizeTerminal({
      sessionId: 'session-1',
      cols: 80,
      rows: 24,
    })).resolves.toBe(false);
    await expect(
      frontendStationService.destroyTerminalSession('session-1'),
    ).resolves.toBe(false);
  });
});
