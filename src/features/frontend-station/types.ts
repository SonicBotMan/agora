/**
 * Type definitions for the Frontend Development Station feature.
 */

// ── DevProject ──────────────────────────────────────────────────────────────

export type ProjectTemplate = 'vite-react' | 'vite-vue' | 'nextjs' | 'blank';

export type ProjectStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface DevProject {
  id: string;
  name: string;
  template: ProjectTemplate;
  path: string;
  port: number;
  status: ProjectStatus;
  createdAt: string; // ISO-8601
}

// ── DevServerConfig ──────────────────────────────────────────────────────────

export interface DevServerConfig {
  projectId: string;
  port: number;
  host?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

// ── TemplateConfig ───────────────────────────────────────────────────────────

export interface TemplateConfig {
  id: ProjectTemplate;
  name: string;
  description: string;
  command: string;
  args: string[];
}

// ── TerminalSession ──────────────────────────────────────────────────────────

export interface TerminalSession {
  sessionId: string;
  projectId: string;
  createdAt: string; // ISO-8601
}

// ── EditorFile ───────────────────────────────────────────────────────────────

export interface EditorFile {
  path: string;
  language: string;
  content: string;
  dirty: boolean;
}

// ── PreviewState ─────────────────────────────────────────────────────────────

export interface PreviewState {
  projectId: string;
  url: string;
  active: boolean;
}
