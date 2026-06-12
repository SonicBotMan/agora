/**
 * TemplateManager — project template scaffolding.
 *
 * Provides built-in templates (vite-react, vite-vue, nextjs, blank)
 * and can scaffold new projects by running the appropriate CLI command.
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { ProjectTemplate, TemplateConfig } from './types';

export interface TemplateManagerFileSystem {
  mkdir: typeof fs.mkdir;
  writeFile: typeof fs.writeFile;
  readdir: typeof fs.readdir;
}

export interface TemplateCommandRunner {
  run: (
    command: string,
    args: string[],
    options: { cwd: string },
  ) => Promise<void>;
}

export interface TemplateManagerOptions {
  fileSystem?: TemplateManagerFileSystem;
  commandRunner?: TemplateCommandRunner;
}

// ── Built-in templates ──────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: TemplateConfig[] = [
  {
    id: 'vite-react',
    name: 'Vite + React',
    description: 'Vite with React + TypeScript',
    command: 'npm',
    args: ['create', 'vite@latest', '--', '--template', 'react-ts'],
  },
  {
    id: 'vite-vue',
    name: 'Vite + Vue',
    description: 'Vite with Vue 3 + TypeScript',
    command: 'npm',
    args: ['create', 'vite@latest', '--', '--template', 'vue-ts'],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Next.js with TypeScript',
    command: 'npx',
    args: ['create-next-app@latest', '--typescript'],
  },
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty directory with a basic package.json',
    command: '',
    args: [],
  },
];

// ── Manager ─────────────────────────────────────────────────────────────────

export class TemplateManager {
  private templates: Map<ProjectTemplate, TemplateConfig>;
  private fileSystem: TemplateManagerFileSystem;
  private commandRunner: TemplateCommandRunner;

  constructor(options: TemplateManagerOptions = {}) {
    this.templates = new Map();
    for (const tpl of BUILT_IN_TEMPLATES) {
      this.templates.set(tpl.id, tpl);
    }
    this.fileSystem = options.fileSystem ?? fs;
    this.commandRunner = options.commandRunner ?? {
      run: (command, args, runtimeOptions) =>
        runCommand(command, args, runtimeOptions),
    };
  }

  /**
   * List all available templates.
   */
  listTemplates(): TemplateConfig[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a single template by ID.
   */
  getTemplate(id: ProjectTemplate): TemplateConfig | undefined {
    return this.templates.get(id);
  }

  /**
   * Register a custom template at runtime.
   */
  registerTemplate(template: TemplateConfig): void {
    this.templates.set(template.id, template);
  }

  /**
   * Scaffold a new project from a template.
   *
   * Skeleton: actual CLI execution is commented out.
   * Replace with child_process.exec / execSync when ready.
   */
  async scaffoldProject(template: ProjectTemplate, name: string, path: string): Promise<void> {
    const tpl = this.templates.get(template);
    if (!tpl) {
      throw new Error(`Unknown template: ${template}`);
    }

    await this.ensureProjectDirectoryAvailable(path);

    if (template === 'blank') {
      await this.scaffoldBlankProject(name, path);
      return;
    }

    const parentDirectory = pathModule.dirname(path);
    const projectDirectoryName = pathModule.basename(path);
    await this.fileSystem.mkdir(parentDirectory, { recursive: true });

    const { command, args } = this.buildScaffoldCommand(
      tpl.id,
      projectDirectoryName,
    );
    await this.commandRunner.run(command, args, {
      cwd: parentDirectory,
    });

    if (this.requiresDependencyInstall(tpl.id)) {
      await this.commandRunner.run('npm', ['install'], {
        cwd: path,
      });
    }
  }

  private async ensureProjectDirectoryAvailable(projectPath: string): Promise<void> {
    const existingEntries = await this.safeReaddir(projectPath);
    if (existingEntries.length > 0) {
      throw new Error(`Project directory is not empty: ${projectPath}`);
    }
  }

  private async scaffoldBlankProject(
    name: string,
    projectPath: string,
  ): Promise<void> {
    await this.fileSystem.mkdir(projectPath, { recursive: true });

    const packageJson = {
      name: this.normalizePackageName(name),
      version: '0.0.0',
      private: true,
      scripts: {
        dev: 'node server.js',
        start: 'node server.js',
      },
    };

    const serverScript = `'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return fallback;
};

const host = getArg('--host', process.env.HOST || '127.0.0.1');
const port = Number(getArg('--port', process.env.PORT || '4173'));
const root = __dirname;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((request, response) => {
  const requestUrl = request.url === '/' ? '/index.html' : request.url || '/index.html';
  const safePath = path.normalize(requestUrl).replace(/^\\/+/, '');
  const filePath = path.join(root, safePath);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
    });
    response.end(content);
  });
});

server.listen(port, host, () => {
  console.log('Frontend Station blank server ready at http://' + host + ':' + port);
});
`;

    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(name)}</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0f172a;
        color: #e2e8f0;
      }
      main {
        width: min(720px, calc(100vw - 48px));
      }
      h1 {
        margin: 0 0 12px;
        font-size: 32px;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: #cbd5e1;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(name)}</h1>
      <p>This blank project was scaffolded by Agora Frontend Station.</p>
    </main>
  </body>
</html>
`;

    await Promise.all([
      this.fileSystem.writeFile(
        pathModule.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2),
        'utf-8',
      ),
      this.fileSystem.writeFile(
        pathModule.join(projectPath, 'server.js'),
        serverScript,
        'utf-8',
      ),
      this.fileSystem.writeFile(
        pathModule.join(projectPath, 'index.html'),
        indexHtml,
        'utf-8',
      ),
    ]);
  }

  private buildScaffoldCommand(
    template: ProjectTemplate,
    projectDirectoryName: string,
  ): { command: string; args: string[] } {
    switch (template) {
      case 'vite-react':
        return {
          command: 'npm',
          args: [
            'create',
            'vite@latest',
            projectDirectoryName,
            '--',
            '--template',
            'react-ts',
          ],
        };
      case 'vite-vue':
        return {
          command: 'npm',
          args: [
            'create',
            'vite@latest',
            projectDirectoryName,
            '--',
            '--template',
            'vue-ts',
          ],
        };
      case 'nextjs':
        return {
          command: 'npx',
          args: [
            'create-next-app@latest',
            projectDirectoryName,
            '--ts',
            '--use-npm',
            '--yes',
            '--eslint',
            '--app',
            '--src-dir',
            '--import-alias',
            '@/*',
          ],
        };
      case 'blank':
        return {
          command: '',
          args: [],
        };
      default:
        throw new Error(`Unknown template: ${template}`);
    }
  }

  private async safeReaddir(projectPath: string): Promise<string[]> {
    try {
      return await this.fileSystem.readdir(projectPath);
    } catch (error) {
      if (
        error instanceof Error
        && 'code' in error
        && (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return [];
      }
      throw error;
    }
  }

  private normalizePackageName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'frontend-station-project';
  }

  private requiresDependencyInstall(template: ProjectTemplate): boolean {
    return template === 'vite-react' || template === 'vite-vue';
  }
}

const pathModule = path;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'inherit',
      shell: false,
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Scaffolding command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`,
        ),
      );
    });
  });
}
