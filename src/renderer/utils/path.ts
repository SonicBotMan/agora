export const getLastPathSegment = (rawPath: string): string => {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';

  const withoutTrailingSeparators = trimmed.replace(/[\\/]+$/, '');
  const normalized = withoutTrailingSeparators || trimmed;
  const parts = normalized.split(/[\\/]+/).filter(Boolean);

  if (parts.length === 0) {
    return normalized;
  }

  return parts[parts.length - 1];
};

export const getCompactFolderName = (rawPath: string, maxLength?: number): string => {
  const folderName = getLastPathSegment(rawPath);
  if (!folderName) return '';

  if (typeof maxLength === 'number' && maxLength > 0 && folderName.length > maxLength) {
    return folderName.slice(-maxLength);
  }

  return folderName;
};

export const sanitizePathSegment = (rawValue: string): string => {
  const trimmed = rawValue.trim();
  const normalized = trimmed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  if (normalized) {
    return normalized;
  }

  return trimmed.replace(/[\\/]+/g, '-').slice(0, 64);
};

export const joinPathSegments = (basePath: string, childSegment: string): string => {
  const trimmedBase = basePath.trim();
  const trimmedChild = childSegment.trim();

  if (!trimmedBase) return trimmedChild;
  if (!trimmedChild) return trimmedBase;

  const separator = trimmedBase.includes('\\') ? '\\' : '/';
  return `${trimmedBase.replace(/[\\/]+$/, '')}${separator}${trimmedChild.replace(/^[\\/]+/, '')}`;
};
