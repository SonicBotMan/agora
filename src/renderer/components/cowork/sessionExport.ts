const INVALID_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]/g;

export const sanitizeExportFileName = (value: string): string => {
  const sanitized = value.replace(INVALID_FILE_NAME_PATTERN, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || 'cowork-session';
};

export const formatExportTimestamp = (value: Date): string => {
  const pad = (num: number): string => String(num).padStart(2, '0');
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
};

export const MAX_EXPORT_CANVAS_HEIGHT = 32760;
export const MAX_EXPORT_SEGMENTS = 240;
