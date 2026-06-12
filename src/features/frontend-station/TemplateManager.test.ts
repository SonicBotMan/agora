import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplateManager } from './TemplateManager';

function createFileSystem() {
  const directories = new Set<string>();
  const files = new Map<string, string>();

  return {
    directories,
    files,
    mkdir: vi.fn(async (target: string) => {
      directories.add(target);
    }),
    writeFile: vi.fn(async (target: string, content: string) => {
      files.set(target, content);
    }),
    readdir: vi.fn(async (target: string) => {
      if (!directories.has(target)) {
        const error = Object.assign(new Error(`ENOENT: ${target}`), {
          code: 'ENOENT',
        });
        throw error;
      }

      const prefix = target.endsWith('/') ? target : `${target}/`;
      return Array.from(files.keys())
        .filter((filePath) => filePath.startsWith(prefix))
        .map((filePath) => filePath.slice(prefix.length));
    }),
  };
}

describe('TemplateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scaffolds a blank project with package metadata, server entry, and index page', async () => {
    const fileSystem = createFileSystem();
    const manager = new TemplateManager({
      fileSystem: fileSystem as never,
    });

    await manager.scaffoldProject(
      'blank',
      'Agora Playground',
      '/tmp/agora/frontend-station/project-1',
    );

    expect(fileSystem.mkdir).toHaveBeenCalledWith(
      '/tmp/agora/frontend-station/project-1',
      { recursive: true },
    );
    expect(
      JSON.parse(
        fileSystem.files.get('/tmp/agora/frontend-station/project-1/package.json')
        ?? '{}',
      ),
    ).toMatchObject({
      name: 'agora-playground',
      private: true,
      scripts: {
        dev: 'node server.js',
        start: 'node server.js',
      },
    });
    expect(
      fileSystem.files.get('/tmp/agora/frontend-station/project-1/server.js'),
    ).toContain('Frontend Station blank server ready');
    expect(
      fileSystem.files.get('/tmp/agora/frontend-station/project-1/index.html'),
    ).toContain('<h1>Agora Playground</h1>');
  });

  it('runs the expected scaffold command for vite templates from the parent directory', async () => {
    const fileSystem = createFileSystem();
    const commandRunner = {
      run: vi.fn(async () => {}),
    };
    const manager = new TemplateManager({
      fileSystem: fileSystem as never,
      commandRunner,
    });

    await manager.scaffoldProject(
      'vite-react',
      'ignored-by-cli-template',
      '/tmp/agora/frontend-station/vite-app',
    );

    expect(fileSystem.mkdir).toHaveBeenCalledWith(
      '/tmp/agora/frontend-station',
      { recursive: true },
    );
    expect(commandRunner.run).toHaveBeenCalledWith(
      'npm',
      ['create', 'vite@latest', 'vite-app', '--', '--template', 'react-ts'],
      { cwd: '/tmp/agora/frontend-station' },
    );
    expect(commandRunner.run).toHaveBeenNthCalledWith(
      2,
      'npm',
      ['install'],
      { cwd: '/tmp/agora/frontend-station/vite-app' },
    );
  });
});
