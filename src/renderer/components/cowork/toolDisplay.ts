import { i18nService } from '../../services/i18n';
import type { CoworkMessage, CoworkMessageMetadata } from '../../types/cowork';

const ANSI_ESCAPE_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const TOOL_USE_ERROR_TAG_PATTERN = /^<tool_use_error>([\s\S]*?)<\/tool_use_error>$/i;

export const normalizeToolName = (value: string): string =>
  value.toLowerCase().replace(/[\s_]+/g, '');

export const isBashLikeToolName = (toolName: string | undefined): boolean => {
  if (!toolName) return false;
  const normalized = normalizeToolName(toolName);
  return normalized === 'bash' || normalized === 'exec' || normalized === 'shell';
};

export const getToolInputString = (
  input: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
};

export const truncatePreview = (value: string, maxLength = 120): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;

export const normalizeToolResultText = (value: string): string => {
  const withoutAnsi = value.replace(ANSI_ESCAPE_PATTERN, '');
  const errorTagMatch = withoutAnsi.trim().match(TOOL_USE_ERROR_TAG_PATTERN);
  return errorTagMatch ? errorTagMatch[1].trim() : withoutAnsi;
};

export const isTodoWriteToolName = (toolName: string | undefined): boolean => {
  if (!toolName) return false;
  return normalizeToolName(toolName) === 'todowrite';
};

export const isCronToolName = (toolName: string | undefined): boolean => {
  if (!toolName) return false;
  return normalizeToolName(toolName) === 'cron';
};

export const getCronToolSummary = (input: Record<string, unknown>): string | null => {
  const action = getToolInputString(input, ['action']);
  if (!action) return null;

  const job = input.job && typeof input.job === 'object'
    ? input.job as Record<string, unknown>
    : null;
  const jobName = job
    ? getToolInputString(job, ['name', 'id'])
    : null;
  const jobId = getToolInputString(input, ['jobId', 'id'])
    ?? (job ? getToolInputString(job, ['id']) : null);
  const wakeText = getToolInputString(input, ['text']);

  switch (action) {
    case 'add':
      return [action, jobName ?? jobId].filter(Boolean).join(' · ');
    case 'update':
    case 'remove':
    case 'run':
    case 'runs':
      return [action, jobId ?? jobName].filter(Boolean).join(' · ');
    case 'wake':
      return [action, wakeText].filter(Boolean).join(' · ');
    default:
      return action;
  }
};

export const formatStructuredText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return value;
  }
};

const toTrimmedString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

export const getToolDisplayName = (toolName: string | undefined): string => {
  if (!toolName) return '';
  const normalized = normalizeToolName(toolName);
  switch (normalized) {
    case 'bash':
    case 'exec':
    case 'shell':
      return i18nService.t('toolBash');
    case 'read':
    case 'readfile':
      return i18nService.t('toolRead');
    case 'write':
    case 'writefile':
      return i18nService.t('toolWrite');
    case 'edit':
    case 'editfile':
      return i18nService.t('toolEdit');
    case 'multiedit':
      return i18nService.t('toolMultiEdit');
    case 'glob':
      return i18nService.t('toolGlob');
    case 'grep':
      return i18nService.t('toolGrep');
    case 'task':
      return i18nService.t('toolTask');
    case 'webfetch':
      return i18nService.t('toolWebFetch');
    case 'process':
      return i18nService.t('toolProcess');
    case 'todowrite':
      return i18nService.t('toolTodoWrite');
    case 'cron':
      return i18nService.t('toolCron');
    default:
      return toolName;
  }
};

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'unknown';

export type ParsedTodoItem = {
  primaryText: string;
  secondaryText: string | null;
  status: TodoStatus;
};

const normalizeTodoStatus = (value: unknown): TodoStatus => {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/-/g, '_')
    : '';

  if (normalized === 'completed') return 'completed';
  if (normalized === 'in_progress' || normalized === 'running') return 'in_progress';
  if (normalized === 'pending' || normalized === 'todo') return 'pending';
  return 'unknown';
};

export const parseTodoWriteItems = (input: unknown): ParsedTodoItem[] | null => {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.todos)) return null;

  const parsedItems = record.todos
    .map((rawTodo) => {
      if (!rawTodo || typeof rawTodo !== 'object') {
        return null;
      }

      const todo = rawTodo as Record<string, unknown>;
      const activeForm = toTrimmedString(todo.activeForm);
      const content = toTrimmedString(todo.content);
      const primaryText = activeForm ?? content ?? i18nService.t('coworkTodoUntitled');
      const secondaryText = content && content !== primaryText ? content : null;

      return {
        primaryText,
        secondaryText,
        status: normalizeTodoStatus(todo.status),
      } satisfies ParsedTodoItem;
    })
    .filter((item): item is ParsedTodoItem => item !== null);

  return parsedItems.length > 0 ? parsedItems : null;
};

const getTodoWriteSummary = (items: ParsedTodoItem[]): string => {
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const inProgressCount = items.filter((item) => item.status === 'in_progress').length;
  const pendingCount = items.length - completedCount - inProgressCount;

  const summary = [
    `${items.length} ${i18nService.t('coworkTodoItems')}`,
    `${completedCount} ${i18nService.t('coworkTodoCompleted')}`,
    `${inProgressCount} ${i18nService.t('coworkTodoInProgress')}`,
    `${pendingCount} ${i18nService.t('coworkTodoPending')}`,
  ];

  const activeItem = items.find((item) => item.status === 'in_progress');
  if (activeItem) {
    summary.push(activeItem.primaryText);
  }

  return summary.join(' · ');
};

export const getToolInputSummary = (
  toolName: string | undefined,
  toolInput?: Record<string, unknown>,
  getStringArray?: (value: unknown) => string | null,
): string | null => {
  if (!toolName || !toolInput) return null;
  const input = toolInput as Record<string, unknown>;
  if (isTodoWriteToolName(toolName)) {
    const items = parseTodoWriteItems(input);
    return items ? getTodoWriteSummary(items) : null;
  }

  const normalizedToolName = normalizeToolName(toolName);

  switch (normalizedToolName) {
    case 'cron':
      return getCronToolSummary(input);
    case 'bash':
    case 'exec':
    case 'shell':
      return getToolInputString(input, ['command', 'cmd', 'script'])
        ?? (getStringArray ? getStringArray(input.commands) : null);
    case 'read':
    case 'readfile':
    case 'write':
    case 'writefile':
    case 'edit':
    case 'editfile':
    case 'multiedit':
      return getToolInputString(input, ['file_path', 'path', 'filePath', 'target_file', 'targetFile'])
        ?? (
          typeof input.content === 'string' && input.content.trim()
            ? truncatePreview(input.content.split('\n')[0].trim())
            : null
        );
    case 'glob':
    case 'grep':
      return getToolInputString(input, ['pattern', 'query']);
    case 'task':
      return getToolInputString(input, ['description', 'task']);
    case 'webfetch':
      return getToolInputString(input, ['url']);
    case 'process': {
      const action = getToolInputString(input, ['action']);
      const sessionId = getToolInputString(input, ['sessionId', 'session_id']);
      if (action && sessionId) return `${action} · ${sessionId}`;
      return action ?? sessionId;
    }
    default:
      return null;
  }
};

export const formatToolInput = (
  toolName: string | undefined,
  toolInput: Record<string, unknown> | undefined,
  formatUnknown: (value: unknown) => string,
  getStringArray: (value: unknown) => string | null,
): string | null => {
  if (!toolInput) return null;
  const summary = getToolInputSummary(toolName, toolInput, getStringArray);
  if (summary && summary.trim()) {
    return summary;
  }
  return formatUnknown(toolInput);
};

export const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export type GeneratedImage = {
  path: string;
  name?: string;
  mimeType?: string;
  source?: string;
};

export const getGeneratedImages = (metadata?: CoworkMessageMetadata): GeneratedImage[] => {
  const images = metadata?.generatedImages;
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is GeneratedImage => (
    Boolean(image)
    && typeof image === 'object'
    && typeof (image as GeneratedImage).path === 'string'
    && (image as GeneratedImage).path.trim().length > 0
  ));
};

export const encodeLocalFileSrc = (filePath: string): string => {
  const raw = filePath.trim();
  const normalized = raw.replace(/\\/g, '/');
  const fileUrl = /^file:\/\//i.test(normalized)
    ? normalized
    : normalized.startsWith('/')
      ? `file://${normalized}`
      : `file:///${normalized}`;
  return encodeURI(fileUrl)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/^file:\/\//i, 'localfile://');
};

export const getGeneratedImageName = (image: GeneratedImage): string => {
  if (image.name?.trim()) return image.name.trim();
  const segments = image.path.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1] || 'generated-image.png';
};

export const getToolResultDisplay = (message: CoworkMessage): string => {
  if (hasText(message.content)) {
    return formatStructuredText(normalizeToolResultText(message.content));
  }
  if (hasText(message.metadata?.toolResult)) {
    return formatStructuredText(normalizeToolResultText(message.metadata?.toolResult ?? ''));
  }
  if (hasText(message.metadata?.error)) {
    return formatStructuredText(normalizeToolResultText(message.metadata?.error ?? ''));
  }
  return '';
};
