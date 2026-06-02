/**
 * Agora — Dialog IPC Handlers
 * Native OS dialogs: directory selection, file open/save, inline file saving,
 * image storage, and reading files as data URLs.
 *
 * Extracted from main.ts lines 5751–5937.
 */

import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';

import { DialogIpcChannel } from '../../shared/dialog/constants';

// ── Constants (extracted from main.ts) ──

const MAX_INLINE_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const IMAGE_FILE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

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

// ── Helper functions (extracted from main.ts) ──

const safeDecodePathComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeLocalFilePath = (value: string): string => {
  const trimmed = value.trim().replace(/^localfile:\/\//i, 'file://');
  if (/^file:\/\//i.test(trimmed)) {
    try {
      return safeDecodePathComponent(new URL(trimmed).pathname);
    } catch {
      return safeDecodePathComponent(trimmed.replace(/^file:\/\//i, ''));
    }
  }
  return path.resolve(safeDecodePathComponent(trimmed));
};

const sanitizeAttachmentFileName = (value?: string): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'attachment';
  const fileName = path.basename(raw);
  // INVALID_FILE_NAME_PATTERN from main.ts: matches path separators and control chars
  const sanitized = fileName.replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || 'attachment';
};

const buildUniqueTargetPath = async (directory: string, fileName: string): Promise<string> => {
  const extension = path.extname(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? '' : ` (${index})`;
    const candidate = path.join(directory, `${baseName}${suffix}${extension}`);
    try {
      await fs.promises.access(candidate, fs.constants.F_OK);
    } catch {
      return candidate;
    }
  }

  return path.join(directory, `${baseName}-${Date.now()}${extension}`);
};

const resolveInlineAttachmentDir = (cwd?: string): string => {
  const trimmed = typeof cwd === 'string' ? cwd.trim() : '';
  if (trimmed) {
    const resolved = path.resolve(trimmed);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, '.cowork-temp', 'attachments', 'manual');
    }
  }
  return path.join(app.getPath('temp'), 'agora', 'attachments');
};

const inferAttachmentExtension = (fileName: string, mimeType?: string): string => {
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

// ── Deps interface ──

export interface DialogDeps {
  getMainWindow: () => BrowserWindow | null;
}

// ── Handler registration ──

export function registerDialogHandlers(deps: DialogDeps): void {
  // dialog:selectDirectory
  ipcMain.handle('dialog:selectDirectory', async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions = {
      properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[],
    };
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, path: null };
    }
    return { success: true, path: result.filePaths[0] };
  });

  // dialog:selectFile
  ipcMain.handle(
    'dialog:selectFile',
    async (event, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions = {
        properties: ['openFile'] as ['openFile'],
        title: options?.title,
        filters: options?.filters,
      };
      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, path: null };
      }
      return { success: true, path: result.filePaths[0] };
    },
  );

  // dialog:selectFiles
  ipcMain.handle(
    'dialog:selectFiles',
    async (event, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions = {
        properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[],
        title: options?.title,
        filters: options?.filters,
      };
      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, paths: [] };
      }
      return { success: true, paths: result.filePaths };
    },
  );

  // dialog:saveLocalImageToDirectory (DialogIpcChannel.SaveLocalImageToDirectory)
  ipcMain.handle(
    DialogIpcChannel.SaveLocalImageToDirectory,
    async (
      event,
      options?: { sourcePath?: string; fileName?: string },
    ): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }> => {
      try {
        const rawSourcePath = typeof options?.sourcePath === 'string' ? options.sourcePath.trim() : '';
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

        const ownerWindow = BrowserWindow.fromWebContents(event.sender);
        const dialogOptions = {
          defaultPath: app.getPath('downloads'),
          properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[],
        };
        const result = ownerWindow
          ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
          : await dialog.showOpenDialog(dialogOptions);
        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, canceled: true };
        }

        const selectedDirectory = result.filePaths[0];
        const sourceName = path.basename(sourcePath);
        const safeFileName = sanitizeAttachmentFileName(options?.fileName || sourceName);
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
    },
  );

  // dialog:saveInlineFile
  ipcMain.handle(
    'dialog:saveInlineFile',
    async (
      _event,
      options?: { dataBase64?: string; fileName?: string; mimeType?: string; cwd?: string },
    ) => {
      try {
        const dataBase64 = typeof options?.dataBase64 === 'string' ? options.dataBase64.trim() : '';
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
        const extension = inferAttachmentExtension(safeFileName, options?.mimeType);
        const baseName = extension ? safeFileName.slice(0, -extension.length) : safeFileName;
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const finalName = `${baseName || 'attachment'}-${uniqueSuffix}${extension}`;
        const outputPath = path.join(dir, finalName);

        await fs.promises.writeFile(outputPath, buffer);
        return { success: true, path: outputPath };
      } catch (error) {
        return {
          success: false,
          path: null,
          error: error instanceof Error ? error.message : 'Failed to save inline file',
        };
      }
    },
  );

  // dialog:readFileAsDataUrl
  const MAX_READ_AS_DATA_URL_BYTES = 20 * 1024 * 1024;
  const MIME_BY_EXT: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
  };

  ipcMain.handle(
    'dialog:readFileAsDataUrl',
    async (_event, filePath?: string): Promise<{ success: boolean; dataUrl?: string; error?: string }> => {
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
        const base64 = buffer.toString('base64');
        return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read file',
        };
      }
    },
  );
}
