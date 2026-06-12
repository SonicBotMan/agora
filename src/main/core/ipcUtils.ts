/**
 * Agora IPC & UI Utility Functions
 * Extracted from main.ts - pure functions with no state dependencies.
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';

import { isCoworkAgentEngine, isRuntimeCallSource,isRuntimeCallStatus } from '../../shared/cowork/constants';
import type { CoworkFileActivity } from '../../shared/cowork/fileActivity';
import type { RuntimeMetricsFilters } from '../../shared/cowork/runtimeMetrics';

/**
 * Screenshot / image capture rectangle, in CSS pixels.
 * Defined here (not in a shared module) to avoid a circular import;
 * ipcUtils only needs the shape for normalizing user-provided rects.
 */
export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const INVALID_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]/g;
const IPC_MAX_ITEMS = 500;
// IPC payload sanitization limits — keep these in sync with the renderer-side
// IpcStringLimits constant. Strings longer than IPC_STRING_MAX_CHARS are
// truncated with a marker; deeply-nested payloads are flattened to a summary.
const IPC_STRING_MAX_CHARS = 120_000;
export const IPC_UPDATE_CONTENT_MAX_CHARS = 120_000;
const IPC_MAX_DEPTH = 5;
const IPC_MAX_KEYS = 80;


export const sanitizeExportFileName = (value: string): string => {
  const sanitized = value.replace(INVALID_FILE_NAME_PATTERN, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || 'cowork-session';
};


export const sanitizeAttachmentFileName = (value?: string): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'attachment';
  const fileName = path.basename(raw);
  const sanitized = fileName.replace(INVALID_FILE_NAME_PATTERN, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || 'attachment';
};


export const safeDecodePathComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};


export const normalizeLocalFilePath = (value: string): string => {
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


export const buildUniqueTargetPath = async (
  directory: string,
  fileName: string,
): Promise<string> => {
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


export const resolveInlineAttachmentDir = (cwd?: string): string => {
  const trimmed = typeof cwd === 'string' ? cwd.trim() : '';
  if (trimmed) {
    const resolved = path.resolve(trimmed);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, '.cowork-temp', 'attachments', 'manual');
    }
  }
  return path.join(app.getPath('temp'), 'agora', 'attachments');
};


export const ensurePngFileName = (value: string): string => {
  return value.toLowerCase().endsWith('.png') ? value : `${value}.png`;
};

export const ensureZipFileName = (value: string): string => {
  return value.toLowerCase().endsWith('.zip') ? value : `${value}.zip`;
};

const padTwoDigits = (value: number): string => value.toString().padStart(2, '0');

export const buildLogExportFileName = (): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${padTwoDigits(now.getMonth() + 1)}${padTwoDigits(now.getDate())}`;
  const timePart = `${padTwoDigits(now.getHours())}${padTwoDigits(now.getMinutes())}${padTwoDigits(now.getSeconds())}`;
  return `agora-logs-${datePart}-${timePart}.zip`;
};

export const truncateIpcString = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated in main IPC forwarding]`;
};

export const sanitizeIpcPayload = (
  value: unknown,
  depth = 0,
  seen?: WeakSet<object>,
): unknown => {
  const localSeen = seen ?? new WeakSet<object>();
  if (
    value === null
    || typeof value === 'number'
    || typeof value === 'boolean'
    || typeof value === 'undefined'
  ) {
    return value;
  }
  if (typeof value === 'string') {
    return truncateIpcString(value, IPC_STRING_MAX_CHARS);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'function') {
    return '[function]';
  }
  if (depth >= IPC_MAX_DEPTH) {
    return '[truncated-depth]';
  }
  if (Array.isArray(value)) {
    const result = value.slice(0, IPC_MAX_ITEMS).map((entry) => sanitizeIpcPayload(entry, depth + 1, localSeen));
    if (value.length > IPC_MAX_ITEMS) {
      result.push(`[truncated-items:${value.length - IPC_MAX_ITEMS}]`);
    }
    return result;
  }
  if (typeof value === 'object') {
    if (localSeen.has(value as object)) {
      return '[circular]';
    }
    localSeen.add(value as object);
    const entries = Object.entries(value as Record<string, unknown>);
    const result: Record<string, unknown> = {};
    for (const [key, entry] of entries.slice(0, IPC_MAX_KEYS)) {
      result[key] = sanitizeIpcPayload(entry, depth + 1, localSeen);
    }
    if (entries.length > IPC_MAX_KEYS) {
      result.__truncated_keys__ = entries.length - IPC_MAX_KEYS;
    }
    return result;
  }
  return String(value);
};


export const sanitizeCoworkMessageForIpc = (
  message: unknown,
): unknown => {
  if (!message || typeof message !== 'object') {
    return message;
  }

  const messageRecord = message as Record<string, unknown>;

  let sanitizedMetadata: unknown;
  if (messageRecord.metadata && typeof messageRecord.metadata === 'object') {
    const { imageAttachments, ...rest } = messageRecord.metadata as Record<
      string,
      unknown
    >;
    const sanitizedRest = sanitizeIpcPayload(rest) as
      | Record<string, unknown>
      | undefined;
    sanitizedMetadata = {
      ...(sanitizedRest && typeof sanitizedRest === 'object'
        ? sanitizedRest
        : {}),
      ...(Array.isArray(imageAttachments) && imageAttachments.length > 0
        ? { imageAttachments }
        : {}),
    };
  } else {
    sanitizedMetadata = undefined;
  }

  return {
    ...messageRecord,
    content:
      typeof messageRecord.content === 'string'
        ? truncateIpcString(messageRecord.content, IPC_STRING_MAX_CHARS)
        : '',
    metadata: sanitizedMetadata,
  };
};


export const sanitizeCoworkFileActivityForIpc = (
  activity: CoworkFileActivity,
): CoworkFileActivity => ({
  ...activity,
  content: activity.content === null
    ? null
    : truncateIpcString(activity.content, IPC_UPDATE_CONTENT_MAX_CHARS),
});


export const sanitizePermissionRequestForIpc = (
  request: unknown,
): unknown => {
  if (!request || typeof request !== 'object') {
    return request;
  }
  const requestRecord = request as Record<string, unknown>;
  return {
    ...requestRecord,
    toolInput: sanitizeIpcPayload(requestRecord.toolInput ?? {}),
  };
};


export const normalizeRuntimeMetricsFilters = (
  input: unknown,
): RuntimeMetricsFilters => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const filters: RuntimeMetricsFilters = {};
  const from = Number(record.from);
  const to = Number(record.to);
  if (Number.isFinite(from)) filters.from = from;
  if (Number.isFinite(to)) filters.to = to;
  if (isCoworkAgentEngine(record.engine)) filters.engine = record.engine;
  if (typeof record.modelId === 'string' && record.modelId.trim()) filters.modelId = record.modelId.trim();
  if (typeof record.providerKey === 'string' && record.providerKey.trim()) filters.providerKey = record.providerKey.trim();
  if (isRuntimeCallStatus(record.status)) filters.status = record.status;
  if (isRuntimeCallSource(record.source)) filters.source = record.source;
  if (typeof record.sessionId === 'string' && record.sessionId.trim()) filters.sessionId = record.sessionId.trim();
  const limit = Number(record.limit);
  const offset = Number(record.offset);
  if (Number.isFinite(limit)) filters.limit = limit;
  if (Number.isFinite(offset)) filters.offset = offset;
  return filters;
};


export const normalizeCaptureRect = (
  rect?: Partial<CaptureRect> | null,
): CaptureRect | null => {
  if (!rect) return null;
  const normalized = {
    x: Math.max(0, Math.round(typeof rect.x === 'number' ? rect.x : 0)),
    y: Math.max(0, Math.round(typeof rect.y === 'number' ? rect.y : 0)),
    width: Math.max(0, Math.round(typeof rect.width === 'number' ? rect.width : 0)),
    height: Math.max(0, Math.round(typeof rect.height === 'number' ? rect.height : 0)),
  };
  return normalized.width > 0 && normalized.height > 0 ? normalized : null;
};


export const resolveTaskWorkingDirectory = (
  workspaceRoot: string,
): string => {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  // Reject bare Windows drive roots (e.g. "D:\") — mkdir on drive roots causes EPERM,
  // and some agent engines (OpenClaw) also fail when given a drive root as workspace.
  if (process.platform === 'win32' && /^[a-zA-Z]:\\?$/.test(resolvedWorkspaceRoot)) {
    throw new Error(`Cannot use a drive root as the working directory (${resolvedWorkspaceRoot}). Please select a subfolder instead, for example: ${resolvedWorkspaceRoot}Projects`);
  }
  if (!fs.existsSync(resolvedWorkspaceRoot)) {
    fs.mkdirSync(resolvedWorkspaceRoot, { recursive: true });
  }
  if (!fs.statSync(resolvedWorkspaceRoot).isDirectory()) {
    throw new Error(`Selected workspace is not a directory: ${resolvedWorkspaceRoot}`);
  }
  return resolvedWorkspaceRoot;
};


export const getDefaultExportImageName = (
  defaultFileName?: string,
): string => {
  const normalized = typeof defaultFileName === 'string' && defaultFileName.trim()
    ? defaultFileName.trim()
    : `cowork-session-${Date.now()}`;
  return ensurePngFileName(sanitizeExportFileName(normalized));
};
