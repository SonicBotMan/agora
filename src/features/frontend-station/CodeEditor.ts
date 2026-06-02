/**
 * CodeEditor — Monaco Editor integration interface.
 *
 * Skeleton implementation. Monaco Editor is loaded on demand via
 * dynamic import when the editor is first opened. The consuming
 * layer is responsible for mounting Monaco into the DOM.
 */

import type { EditorFile } from './types';

// ── Editor Manager ──────────────────────────────────────────────────────────

export class CodeEditor {
  /** projectId → filePath → EditorFile */
  private files: Map<string, Map<string, EditorFile>> = new Map();
  private activeProjectId: string | null = null;
  private activeFilePath: string | null = null;

  /**
   * Open a file in the editor. Loads Monaco on first use (skeleton).
   */
  async openFile(projectId: string, filePath: string): Promise<void> {
    // Ensure project bucket exists
    if (!this.files.has(projectId)) {
      this.files.set(projectId, new Map());
    }

    const projectFiles = this.files.get(projectId)!;

    if (!projectFiles.has(filePath)) {
      const file = await this.loadFileFromDisk(projectId, filePath);
      projectFiles.set(filePath, file);
    }

    this.activeProjectId = projectId;
    this.activeFilePath = filePath;

    // ── Skeleton: set Monaco model ──────────────────────────────
    // const model = monaco.editor.createModel(content, language);
    // editor.setModel(model);
  }

  /**
   * Save the currently active file.
   */
  async saveFile(projectId: string): Promise<void> {
    const file = this.getActiveFile(projectId);
    if (!file || !file.dirty) {
      return;
    }

    // ── Skeleton: write to disk ─────────────────────────────────
    // await fs.promises.writeFile(file.path, file.content, 'utf-8');

    file.dirty = false;
  }

  /**
   * Get file content from in-memory state.
   */
  getFileContent(projectId: string, filePath: string): string {
    const projectFiles = this.files.get(projectId);
    if (!projectFiles) {
      throw new Error(`No files open for project: ${projectId}`);
    }
    const file = projectFiles.get(filePath);
    if (!file) {
      throw new Error(`File not open: ${filePath}`);
    }
    return file.content;
  }

  /**
   * Set file content in the in-memory buffer and mark as dirty.
   */
  setFileContent(projectId: string, filePath: string, content: string): void {
    const projectFiles = this.files.get(projectId);
    if (!projectFiles) {
      throw new Error(`No files open for project: ${projectId}`);
    }
    const file = projectFiles.get(filePath);
    if (!file) {
      throw new Error(`File not open: ${filePath}`);
    }

    file.content = content;
    file.dirty = true;
  }

  /**
   * List all open files for a project.
   */
  getOpenFiles(projectId: string): EditorFile[] {
    const projectFiles = this.files.get(projectId);
    if (!projectFiles) {
      return [];
    }
    return Array.from(projectFiles.values());
  }

  /**
   * Close an open file, discarding unsaved changes.
   */
  closeFile(projectId: string, filePath: string): void {
    const projectFiles = this.files.get(projectId);
    if (!projectFiles) {
      return;
    }
    projectFiles.delete(filePath);

    if (this.activeProjectId === projectId && this.activeFilePath === filePath) {
      this.activeFilePath = null;
    }
  }

  // ── Internal helpers ───────────────────────────────────────────

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      css: 'css',
      scss: 'scss',
      html: 'html',
      md: 'markdown',
      vue: 'html',
      svg: 'xml',
    };
    return languageMap[ext] ?? 'plaintext';
  }

  private async loadFileFromDisk(projectId: string, filePath: string): Promise<EditorFile> {
    // ── Skeleton: read from filesystem ───────────────────────────
    // const content = await fs.promises.readFile(filePath, 'utf-8');

    return {
      path: filePath,
      language: this.detectLanguage(filePath),
      content: '', // placeholder
      dirty: false,
    };
  }

  private getActiveFile(projectId: string): EditorFile | null {
    if (this.activeProjectId !== projectId || !this.activeFilePath) {
      return null;
    }
    const projectFiles = this.files.get(projectId);
    if (!projectFiles) {
      return null;
    }
    return projectFiles.get(this.activeFilePath) ?? null;
  }
}
