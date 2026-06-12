import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CodeEditor } from './CodeEditor';

describe('CodeEditor', () => {
  const files = new Map<string, string>();

  beforeEach(() => {
    files.clear();
    files.set('/tmp/agora-demo/src/App.tsx', 'export const App = () => null;\n');
  });

  it('lists project files while filtering generated directories', async () => {
    const editor = new CodeEditor({
      fileSystem: {
        readFile: vi.fn(async (filePath: string) => files.get(filePath) ?? ''),
        writeFile: vi.fn(async () => {}),
        readdir: vi.fn(async (directoryPath: string) => {
          if (directoryPath === '/tmp/agora-demo') {
            return [
              createDirent('src', true),
              createDirent('node_modules', true),
              createDirent('package.json', false),
            ];
          }
          if (directoryPath === '/tmp/agora-demo/src') {
            return [
              createDirent('App.tsx', false),
            ];
          }
          return [];
        }),
      },
    });

    await expect(editor.listProjectFiles('/tmp/agora-demo')).resolves.toEqual([
      {
        name: 'src',
        path: '/tmp/agora-demo/src',
        relativePath: 'src',
        type: 'directory',
        children: [
          {
            name: 'App.tsx',
            path: '/tmp/agora-demo/src/App.tsx',
            relativePath: 'src/App.tsx',
            type: 'file',
          },
        ],
      },
      {
        name: 'package.json',
        path: '/tmp/agora-demo/package.json',
        relativePath: 'package.json',
        type: 'file',
      },
    ]);
  });

  it('opens, edits, and saves files through the injected filesystem', async () => {
    const writeFile = vi.fn(async (filePath: string, content: string) => {
      files.set(filePath, content);
    });
    const editor = new CodeEditor({
      fileSystem: {
        readFile: vi.fn(async (filePath: string) => files.get(filePath) ?? ''),
        writeFile,
        readdir: vi.fn(async () => []),
      },
    });

    const openedFile = await editor.openFile('project-1', '/tmp/agora-demo/src/App.tsx');
    expect(openedFile).toMatchObject({
      path: '/tmp/agora-demo/src/App.tsx',
      language: 'typescript',
      dirty: false,
    });

    editor.setFileContent('project-1', '/tmp/agora-demo/src/App.tsx', 'export const App = () => <main />;\n');
    const savedFile = await editor.saveFile(
      'project-1',
      '/tmp/agora-demo/src/App.tsx',
    );

    expect(savedFile.dirty).toBe(false);
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/agora-demo/src/App.tsx',
      'export const App = () => <main />;\n',
      'utf-8',
    );
  });
});

function createDirent(name: string, isDirectory: boolean) {
  return {
    name,
    isDirectory: () => isDirectory,
  };
}
