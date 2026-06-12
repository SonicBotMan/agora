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
  cwd: string;
  shell: string;
  status: 'running' | 'exited';
  exitCode?: number | null;
  createdAt: string; // ISO-8601
}

// ── EditorFile ───────────────────────────────────────────────────────────────

export interface EditorFile {
  path: string;
  relativePath?: string;
  language: string;
  content: string;
  dirty: boolean;
}

export interface ProjectFileNode {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  children?: ProjectFileNode[];
}

// ── PreviewState ─────────────────────────────────────────────────────────────

export interface PreviewState {
  projectId: string;
  url: string;
  active: boolean;
}

// ── Runtime Events ──────────────────────────────────────────────────────────

export interface FrontendProjectCreatedEvent {
  type: 'project-created';
  project: DevProject;
}

export interface FrontendServerReadyEvent {
  type: 'server-ready';
  projectId: string;
  url: string;
}

export interface FrontendServerStoppedEvent {
  type: 'server-stopped';
  projectId: string;
}

export interface FrontendServerErrorEvent {
  type: 'server-error';
  projectId: string;
  error: string;
}

export interface FrontendTerminalOutputEvent {
  type: 'terminal-output';
  sessionId: string;
  projectId: string;
  data: string;
}

export interface FrontendTerminalExitEvent {
  type: 'terminal-exit';
  sessionId: string;
  projectId: string;
  exitCode: number | null;
}

export type FrontendStationEvent =
  | FrontendProjectCreatedEvent
  | FrontendServerReadyEvent
  | FrontendServerStoppedEvent
  | FrontendServerErrorEvent
  | FrontendTerminalOutputEvent
  | FrontendTerminalExitEvent;
