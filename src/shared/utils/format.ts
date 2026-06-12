/**
 * Shared formatting utilities used across main and renderer processes.
 */

/**
 * Format a timestamp string for display.
 * Returns a localized date/time string or a fallback.
 */
export function formatTimestamp(value: string | undefined | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + '\u2026';
}

/**
 * Generate a short ID suitable for display (first 8 chars of a UUID).
 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
