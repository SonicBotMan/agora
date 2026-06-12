import crypto from 'crypto';
import path from 'path';

export const USER_MEMORIES_MIGRATION_KEY =
  'userMemories.migration.v1.completed';

export interface LegacyMemoryFileSystem {
  existsSync: (path: string) => boolean;
  statSync: (path: string) => { isFile: () => boolean };
  readFileSync: (path: string, encoding: 'utf8') => string;
}

export function getLegacyMemoryCandidates(
  cwd: string,
  appPath: string,
): string[] {
  return [
    path.join(cwd, 'MEMORY.md'),
    path.join(appPath, 'MEMORY.md'),
    path.join(cwd, 'memory.md'),
    path.join(appPath, 'memory.md'),
  ];
}

export function tryReadLegacyMemoryText(
  candidates: string[],
  fileSystem: LegacyMemoryFileSystem,
): string {
  for (const candidate of candidates) {
    try {
      if (fileSystem.existsSync(candidate) && fileSystem.statSync(candidate).isFile()) {
        return fileSystem.readFileSync(candidate, 'utf8');
      }
    } catch {
      // Skip unreadable candidates.
    }
  }
  return '';
}

export function parseLegacyMemoryEntries(raw: string): string[] {
  const normalized = raw.replace(/```[\s\S]*?```/g, ' ');
  const lines = normalized.split(/\r?\n/);
  const entries: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const match = line.trim().match(/^-+\s*(?:\[[^\]]+\]\s*)?(.+)$/);
    if (!match?.[1]) continue;
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (!text || text.length < 6) continue;
    if (/^\(empty\)$/i.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(text.length > 360 ? `${text.slice(0, 359)}…` : text);
  }

  return entries.slice(0, 200);
}

export function createMemoryFingerprint(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('sha1').update(normalized).digest('hex');
}
