/**
 * Shared validation utilities used across main and renderer processes.
 */

/**
 * Check if a string is a valid URL.
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a non-empty value after trimming.
 */
export function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
