import { EventEmitter } from 'events';
import path from 'path';

import { CodeEditor } from './CodeEditor';
import { DevServerManager } from './DevServerManager';
import { PreviewPanel } from './PreviewPanel';
import { TemplateManager } from './TemplateManager';
import { TerminalManager } from './TerminalManager';
import type {
  DevProject,
  EditorFile,
  FrontendStationEvent,
  PreviewState,
  ProjectFileNode,
  ProjectTemplate,
  TemplateConfig,
  TerminalSession,
} from './types';

export interface FrontendStationRuntimeOptions {
  devServerManager?: DevServerManager;
  previewPanel?: PreviewPanel;
  templateManager?: TemplateManager;
  codeEditor?: CodeEditor;
  terminalManager?: TerminalManager;
}

export class FrontendStationRuntime extends EventEmitter {
  private devServerManager: DevServerManager;
  private previewPanel: PreviewPanel;
  private templateManager: TemplateManager;
  private codeEditor: CodeEditor;
  private terminalManager: TerminalManager;

  constructor(options: FrontendStationRuntimeOptions = {}) {
    super();
    this.devServerManager = options.devServerManager ?? new DevServerManager();
    this.previewPanel = options.previewPanel ?? new PreviewPanel();
    this.templateManager = options.templateManager ?? new TemplateManager();
    this.codeEditor = options.codeEditor ?? new CodeEditor();
    this.terminalManager = options.terminalManager ?? new TerminalManager();
    this.bindDevServerEvents();
    this.bindTerminalEvents();
  }

  listTemplates(): TemplateConfig[] {
    return this.templateManager.listTemplates();
  }

  async createProject(options: {
    name: string;
    template: ProjectTemplate;
    path: string;
  }): Promise<DevProject> {
    await this.templateManager.scaffoldProject(
      options.template,
      options.name,
      options.path,
    );
    const project = await this.devServerManager.createProject(options);
    this.emitEvent({
      type: 'project-created',
      project,
    });
    return project;
  }

  async startServer(projectId: string): Promise<{
    project: DevProject | null;
    preview: PreviewState | null;
  }> {
    await this.devServerManager.startServer(projectId);
    return {
      project: this.getProject(projectId) ?? null,
      preview: this.getPreview(projectId) ?? null,
    };
  }

  async stopServer(projectId: string): Promise<{
    project: DevProject | null;
  }> {
    await this.devServerManager.stopServer(projectId);
    return {
      project: this.getProject(projectId) ?? null,
    };
  }

  async restartServer(projectId: string): Promise<{
    project: DevProject | null;
    preview: PreviewState | null;
  }> {
    await this.devServerManager.restartServer(projectId);
    return {
      project: this.getProject(projectId) ?? null,
      preview: this.getPreview(projectId) ?? null,
    };
  }

  getProjects(): DevProject[] {
    return this.devServerManager.getProjects();
  }

  getProject(projectId: string): DevProject | undefined {
    return this.devServerManager.getProject(projectId);
  }

  getPreview(projectId: string): PreviewState | undefined {
    return this.previewPanel.getPreview(projectId);
  }

  getPreviews(): PreviewState[] {
    return this.previewPanel.getAllPreviews();
  }

  async getFileTree(projectId: string): Promise<ProjectFileNode[]> {
    const project = this.requireProject(projectId);
    return await this.codeEditor.listProjectFiles(project.path);
  }

  async openFile(projectId: string, filePath: string): Promise<EditorFile> {
    const project = this.requireProject(projectId);
    const file = await this.codeEditor.openFile(projectId, filePath);
    return {
      ...file,
      relativePath: this.toRelativeProjectPath(project.path, file.path),
    };
  }

  async saveFile(
    projectId: string,
    filePath: string,
    content: string,
  ): Promise<EditorFile> {
    const project = this.requireProject(projectId);
    const file = await this.codeEditor.saveFile(projectId, filePath, content);
    return {
      ...file,
      relativePath: this.toRelativeProjectPath(project.path, file.path),
    };
  }

  createTerminalSession(projectId: string): TerminalSession {
    const project = this.requireProject(projectId);
    return this.terminalManager.createSession(projectId, project.path);
  }

  getTerminalBuffer(sessionId: string): string {
    return this.terminalManager.getBuffer(sessionId);
  }

  writeTerminal(sessionId: string, data: string): void {
    this.terminalManager.write(sessionId, data);
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    this.terminalManager.resize(sessionId, cols, rows);
  }

  destroyTerminalSession(sessionId: string): boolean {
    const session = this.terminalManager.getSession(sessionId);
    if (!session) {
      return false;
    }
    this.terminalManager.destroySession(sessionId);
    return true;
  }

  private bindDevServerEvents(): void {
    this.devServerManager.on('server-ready', (projectId: string, url: string) => {
      const existing = this.previewPanel.getPreview(projectId);
      if (existing) {
        this.previewPanel.updateUrl(projectId, url);
      } else {
        this.previewPanel.createPreview(projectId, url);
      }

      this.emitEvent({
        type: 'server-ready',
        projectId,
        url,
      });
    });

    this.devServerManager.on('server-stopped', (projectId: string) => {
      this.previewPanel.destroyPreview(projectId);
      this.emitEvent({
        type: 'server-stopped',
        projectId,
      });
    });

    this.devServerManager.on('server-error', (projectId: string, error: Error) => {
      this.emitEvent({
        type: 'server-error',
        projectId,
        error: error.message,
      });
    });
  }

  private bindTerminalEvents(): void {
    this.terminalManager.on(
      'terminal-output',
      (payload: {
        sessionId: string;
        projectId: string;
        data: string;
      }) => {
        this.emitEvent({
          type: 'terminal-output',
          sessionId: payload.sessionId,
          projectId: payload.projectId,
          data: payload.data,
        });
      },
    );

    this.terminalManager.on(
      'terminal-exit',
      (payload: {
        sessionId: string;
        projectId: string;
        exitCode: number | null;
      }) => {
        this.emitEvent({
          type: 'terminal-exit',
          sessionId: payload.sessionId,
          projectId: payload.projectId,
          exitCode: payload.exitCode,
        });
      },
    );
  }

  private emitEvent(event: FrontendStationEvent): void {
    (this.emit as (event: string, payload: FrontendStationEvent) => void)(
      'frontend:event',
      event,
    );
  }

  private requireProject(projectId: string): DevProject {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`Frontend station project not found: ${projectId}`);
    }
    return project;
  }

  private toRelativeProjectPath(projectPath: string, filePath: string): string {
    const relativePath = path.relative(projectPath, filePath);
    return relativePath || path.basename(filePath);
  }
}
