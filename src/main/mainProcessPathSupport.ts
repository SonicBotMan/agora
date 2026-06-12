import path from 'path';

import { APP_NAME } from './appConstants';
import type { MainProcessApp } from './mainProcessEnvironmentContract';

export function configureUserDataPath(app: Pick<MainProcessApp, 'getPath' | 'setPath'>): void {
  const appDataPath = app.getPath('appData');
  const preferredUserDataPath = path.join(appDataPath, APP_NAME);
  const currentUserDataPath = app.getPath('userData');

  if (currentUserDataPath !== preferredUserDataPath) {
    app.setPath('userData', preferredUserDataPath);
    console.log(
      `[Main] userData path updated: ${currentUserDataPath} -> ${preferredUserDataPath}`,
    );
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeShellPathForPlatform(
  inputPath: string,
  isWindows: boolean,
): string {
  if (!isWindows) return inputPath;

  const trimmed = inputPath.trim();
  if (!trimmed) return inputPath;

  let normalized = trimmed;
  if (/^file:\/\//i.test(normalized)) {
    normalized = safeDecodeURIComponent(
      normalized.replace(/^file:\/\//i, ''),
    );
  }

  if (/^\/[A-Za-z]:/.test(normalized)) {
    normalized = normalized.slice(1);
  }

  const unixDriveMatch = normalized.match(/^[/\\]([A-Za-z])[/\\](.+)$/);
  if (unixDriveMatch) {
    const drive = unixDriveMatch[1].toUpperCase();
    const rest = unixDriveMatch[2].replace(/[/\\]+/g, '\\');
    return `${drive}:\\${rest}`;
  }

  if (/^[A-Za-z]:[/\\]/.test(normalized)) {
    const drive = normalized[0].toUpperCase();
    const rest = normalized.slice(1).replace(/\//g, '\\');
    return `${drive}${rest}`;
  }

  return normalized;
}
