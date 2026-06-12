/**
 * Core AttachmentHandler.
 *
 * Centralizes native dialog-backed attachment flows that were previously
 * embedded directly in main-process IPC registration.
 */

import type { BrowserWindow, FileFilter, OpenDialogOptions } from 'electron';
import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

import {
  buildUniqueTargetPath,
  normalizeLocalFilePath,
  resolveInlineAttachmentDir,
  sanitizeAttachmentFileName,
} from '../main/core/ipcUtils';

const MAX_INLINE_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_READ_AS_DATA_URL_BYTES = 20 * 1024 * 1024;

const IMAGE_FILE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'application/json': '.json',
  'text/csv': '.csv',
};

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

export interface AttachmentDialogOptions {
  title?: string;
  filters?: FileFilter[];
}

export interface AttachmentPathResult {
  success: boolean;
  path: string | null;
}

export interface AttachmentPathsResult {
  success: boolean;
  paths: string[];
}

export interface SaveLocalImageOptions {
  sourcePath?: string;
  fileName?: string;
}

export interface SaveLocalImageResult {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

export interface SaveInlineFileOptions {
  dataBase64?: string;
  fileName?: string;
  mimeType?: string;
  cwd?: string;
}

export interface SaveInlineFileResult {
  success: boolean;
  path: string | null;
  error?: string;
}

export interface ReadFileAsDataUrlResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

const inferAttachmentExtension = (
  fileName: string,
  mimeType?: string,
): string => {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName) {
    return fromName;
  }
  if (typeof mimeType === 'string') {
    const normalized = mimeType.toLowerCase().split(';')[0].trim();
    return MIME_EXTENSION_MAP[normalized] ?? '';
  }
  return '';
};

export class AttachmentHandler {
  async selectDirectory(
    ownerWindow?: BrowserWindow | null,
  ): Promise<AttachmentPathResult> {
    const result = await this.showOpenDialog(ownerWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, path: null };
    }
    return { success: true, path: result.filePaths[0] };
  }

  async selectFile(
    ownerWindow?: BrowserWindow | null,
    options?: AttachmentDialogOptions,
  ): Promise<AttachmentPathResult> {
    const result = await this.showOpenDialog(ownerWindow, {
      properties: ['openFile'],
      title: options?.title,
      filters: options?.filters,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, path: null };
    }
    return { success: true, path: result.filePaths[0] };
  }

  async selectFiles(
    ownerWindow?: BrowserWindow | null,
    options?: AttachmentDialogOptions,
  ): Promise<AttachmentPathsResult> {
    const result = await this.showOpenDialog(ownerWindow, {
      properties: ['openFile', 'multiSelections'],
      title: options?.title,
      filters: options?.filters,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, paths: [] };
    }
    return { success: true, paths: result.filePaths };
  }

  async saveLocalImageToDirectory(
    ownerWindow?: BrowserWindow | null,
    options?: SaveLocalImageOptions,
  ): Promise<SaveLocalImageResult> {
    try {
      const rawSourcePath =
        typeof options?.sourcePath === 'string' ? options.sourcePath.trim() : '';
      if (!rawSourcePath) {
        return { success: false, error: 'Missing image path' };
      }

      const sourcePath = normalizeLocalFilePath(rawSourcePath);
      const sourceStat = await fs.promises.stat(sourcePath);
      if (!sourceStat.isFile()) {
        return { success: false, error: 'Image path is not a file' };
      }

      const sourceExtension = path.extname(sourcePath).toLowerCase();
      if (!IMAGE_FILE_EXTENSIONS.has(sourceExtension)) {
        return { success: false, error: 'Unsupported image file type' };
      }

      const result = await this.showOpenDialog(ownerWindow, {
        defaultPath: app.getPath('downloads'),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true };
      }

      const selectedDirectory = result.filePaths[0];
      const sourceName = path.basename(sourcePath);
      const safeFileName = sanitizeAttachmentFileName(
        options?.fileName || sourceName,
      );
      const finalName = path.extname(safeFileName)
        ? safeFileName
        : `${safeFileName}${sourceExtension}`;
      const targetPath = await buildUniqueTargetPath(selectedDirectory, finalName);

      await fs.promises.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
      return { success: true, canceled: false, path: targetPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save image',
      };
    }
  }

  async saveInlineFile(
    options?: SaveInlineFileOptions,
  ): Promise<SaveInlineFileResult> {
    try {
      const dataBase64 =
        typeof options?.dataBase64 === 'string' ? options.dataBase64.trim() : '';
      if (!dataBase64) {
        return { success: false, path: null, error: 'Missing file data' };
      }

      const buffer = Buffer.from(dataBase64, 'base64');
      if (!buffer.length) {
        return { success: false, path: null, error: 'Invalid file data' };
      }
      if (buffer.length > MAX_INLINE_ATTACHMENT_BYTES) {
        return {
          success: false,
          path: null,
          error: `File too large (max ${Math.floor(MAX_INLINE_ATTACHMENT_BYTES / (1024 * 1024))}MB)`,
        };
      }

      const dir = resolveInlineAttachmentDir(options?.cwd);
      await fs.promises.mkdir(dir, { recursive: true });

      const safeFileName = sanitizeAttachmentFileName(options?.fileName);
      const existingExtension = path.extname(safeFileName);
      const extension = existingExtension
        ? existingExtension.toLowerCase()
        : inferAttachmentExtension(safeFileName, options?.mimeType);
      const baseName = existingExtension
        ? safeFileName.slice(0, -existingExtension.length)
        : safeFileName;
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const finalName = `${baseName || 'attachment'}-${uniqueSuffix}${extension}`;
      const outputPath = path.join(dir, finalName);

      await fs.promises.writeFile(outputPath, buffer);
      return { success: true, path: outputPath };
    } catch (error) {
      return {
        success: false,
        path: null,
        error:
          error instanceof Error ? error.message : 'Failed to save inline file',
      };
    }
  }

  async readFileAsDataUrl(
    filePath?: string,
  ): Promise<ReadFileAsDataUrlResult> {
    try {
      if (typeof filePath !== 'string' || !filePath.trim()) {
        return { success: false, error: 'Missing file path' };
      }

      const resolvedPath = path.resolve(filePath.trim());
      const stat = await fs.promises.stat(resolvedPath);
      if (!stat.isFile()) {
        return { success: false, error: 'Not a file' };
      }
      if (stat.size > MAX_READ_AS_DATA_URL_BYTES) {
        return {
          success: false,
          error: `File too large (max ${Math.floor(MAX_READ_AS_DATA_URL_BYTES / (1024 * 1024))}MB)`,
        };
      }

      const buffer = await fs.promises.readFile(resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
      return {
        success: true,
        dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      };
    }
  }

  private showOpenDialog(
    ownerWindow: BrowserWindow | null | undefined,
    options: OpenDialogOptions,
  ) {
    return ownerWindow
      ? dialog.showOpenDialog(ownerWindow, options)
      : dialog.showOpenDialog(options);
  }
}
