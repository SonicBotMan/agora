/**
 * TemplateManager — project template scaffolding.
 *
 * Provides built-in templates (vite-react, vite-vue, nextjs, blank)
 * and can scaffold new projects by running the appropriate CLI command.
 */

import type { ProjectTemplate, TemplateConfig } from './types';

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

  constructor() {
    this.templates = new Map();
    for (const tpl of BUILT_IN_TEMPLATES) {
      this.templates.set(tpl.id, tpl);
    }
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

    if (template === 'blank') {
      // ── Blank: create empty package.json ──────────────────────
      // await fs.promises.mkdir(path, { recursive: true });
      // await fs.promises.writeFile(
      //   path + '/package.json',
      //   JSON.stringify({ name, version: '0.0.0', private: true }, null, 2),
      //   'utf-8',
      // );
      return;
    }

    // ── Skeleton: run scaffolding CLI ────────────────────────────
    // const { execSync } = require('child_process');
    // execSync(`${tpl.command} ${tpl.args.join(' ')} ${name}`, {
    //   cwd: path,
    //   stdio: 'inherit',
    // });
  }
}
