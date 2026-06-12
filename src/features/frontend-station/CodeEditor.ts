import fs, { type Dirent } from 'fs';
import path from 'path';

import type { EditorFile, ProjectFileNode } from './types';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  '.next',
  'build',
  'coverage',
]);

export interface CodeEditorFileSystem {
  readFile: (filePath: string, encoding: 'utf-8') => Promise<string>;
  writeFile: (
    filePath: string,
    content: string,
    encoding: 'utf-8',
  ) => Promise<void>;
  readdir: (
    directoryPath: string,
    options: { withFileTypes: true },
  ) => Promise<Dirent[]>;
}

export interface CodeEditorOptions {
  fileSystem?: CodeEditorFileSystem;
}

// ── Editor Manager ──────────────────────────────────────────────────────────

export class CodeEditor {
  /** projectId → filePath → EditorFile */
  private files: Map<string, Map<string, EditorFile>> = new Map();
  private activeProjectId: string | null = null;
  private activeFilePath: string | null = null;
  private fileSystem: CodeEditorFileSystem;

  constructor(options: CodeEditorOptions = {}) {
    this.fileSystem = options.fileSystem ?? {
      readFile: (filePath, encoding) => fs.promises.readFile(filePath, encoding),
      writeFile: (filePath, content, encoding) =>
        fs.promises.writeFile(filePath, content, encoding),
      readdir: (directoryPath, readOptions) =>
        fs.promises.readdir(directoryPath, readOptions),
    };
  }

  /**
   * Open a file in the editor, loading it from disk on first access and
   * caching the buffer for subsequent edits.
   */
  async openFile(projectId: string, filePath: string): Promise<EditorFile> {
    // Ensure project bucket exists
    if (!this.files.has(projectId)) {
      this.files.set(projectId, new Map());
    }

    const projectFiles = this.files.get(projectId)!;

    if (!projectFiles.has(filePath)) {
      const file = await this.loadFileFromDisk(filePath);
      projectFiles.set(filePath, file);
    }

    this.activeProjectId = projectId;
    this.activeFilePath = filePath;

    return { ...projectFiles.get(filePath)! };
  }

  /**
   * Save the currently active file.
   */
  async saveFile(
    projectId: string,
    filePath: string,
    content?: string,
  ): Promise<EditorFile> {
    const file = this.getFile(projectId, filePath);
    if (!file || !file.dirty) {
      if (file && typeof content === 'string' && file.content !== content) {
        file.content = content;
        file.dirty = true;
      } else if (!file) {
        throw new Error(`File not open: ${filePath}`);
      }
    }

    if (typeof content === 'string' && file.content !== content) {
      file.content = content;
      file.dirty = true;
    }

    if (file.dirty) {
      await this.fileSystem.writeFile(file.path, file.content, 'utf-8');
      file.dirty = false;
    }

    return { ...file };
  }

  async listProjectFiles(projectPath: string): Promise<ProjectFileNode[]> {
    return await this.readDirectoryTree(projectPath, projectPath);
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

  private async loadFileFromDisk(filePath: string): Promise<EditorFile> {
    const content = await this.fileSystem.readFile(filePath, 'utf-8');

    return {
      path: filePath,
      language: this.detectLanguage(filePath),
      content,
      dirty: false,
    };
  }

  private getFile(projectId: string, filePath: string): EditorFile | null {
    const projectFiles = this.files.get(projectId);
    if (!projectFiles) {
      return null;
    }
    return projectFiles.get(filePath) ?? null;
  }

  private async readDirectoryTree(
    rootPath: string,
    currentPath: string,
  ): Promise<ProjectFileNode[]> {
    const entries = await this.fileSystem.readdir(currentPath, {
      withFileTypes: true,
    });

    const visibleEntries = entries
      .filter((entry) => !IGNORED_DIRECTORY_NAMES.has(entry.name))
      .sort((left, right) => {
        if (left.isDirectory() && !right.isDirectory()) return -1;
        if (!left.isDirectory() && right.isDirectory()) return 1;
        return left.name.localeCompare(right.name);
      });

    return await Promise.all(
      visibleEntries.map(async (entry) => {
        const absolutePath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootPath, absolutePath) || entry.name;

        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: absolutePath,
            relativePath,
            type: 'directory' as const,
            children: await this.readDirectoryTree(rootPath, absolutePath),
          };
        }

        return {
          name: entry.name,
          path: absolutePath,
          relativePath,
          type: 'file' as const,
        };
      }),
    );
  }
}
