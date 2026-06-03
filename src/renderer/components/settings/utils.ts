/**
 * Settings — Shared Utilities
 *
 * Helper functions used by multiple settings tabs. Currently houses
 * `joinWorkspacePath` which builds a workspace-relative path string
 * using a platform-aware separator.
 */

/** Join workspace directory with a filename using platform-aware separator. */
export const joinWorkspacePath = (
  dir: string | undefined,
  filename: string,
): string => {
  const base = dir?.trim() || '~/.openclaw/workspace';
  const sep =
    typeof window !== 'undefined' && window.electron?.platform === 'win32'
      ? '\\'
      : '/';
  // Normalize: if base already ends with a separator, don't double it.
  return base.endsWith(sep) || base.endsWith('/') || base.endsWith('\\')
    ? `${base}${filename}`
    : `${base}${sep}${filename}`;
};
