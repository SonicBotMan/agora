import { readdir, readFile } from 'fs/promises';
import { extname,join } from 'path';

import { SkillManifest } from './types';

const YAML_FENCE_PATTERN = /^---\n([\s\S]*?)\n---/;

function parseYamlFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^\d+$/.test(value as string)) value = Number(value);
    else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      value = (value as string)
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      value = String(value).replace(/^['"]|['"]$/g, '');
    }

    result[key] = value;
  }
  return result;
}

export class SkillScanner {
  async scanDirectory(dir: string): Promise<SkillManifest[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const manifests: SkillManifest[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillDir = join(dir, entry.name);
        const skillManifests = await this.scanDirectory(skillDir);
        manifests.push(...skillManifests);
      } else if (extname(entry.name).toLowerCase() === '.md' && entry.name.toUpperCase().startsWith('SKILL')) {
        const filePath = join(dir, entry.name);
        try {
          const manifest = this.parseSkillFile(filePath);
          manifests.push(manifest);
        } catch {
          // skip unparseable files
        }
      }
    }

    return manifests;
  }

  parseSkillFile(filePath: string): SkillManifest {
    const content = readFileSyncSafe(filePath);
    const frontmatter = extractFrontmatter(content);

    const meta = frontmatter ? parseYamlFrontmatter(frontmatter) : {};

    return {
      id: (meta.id as string) || filePath,
      name: (meta.name as string) || filePath,
      version: (meta.version as string) || '0.0.1',
      description: (meta.description as string) || '',
      author: (meta.author as string) || 'unknown',
      tags: (meta.tags as string[]) || [],
      entryFile: (meta.entryFile as string) || filePath,
      enabled: meta.enabled !== false,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: (meta.source as SkillManifest['source']) || 'local',
    };
  }
}

function extractFrontmatter(content: string): string | null {
  const match = YAML_FENCE_PATTERN.exec(content);
  return match ? match[1] : null;
}

function readFileSyncSafe(filePath: string): string {
  // Synchronous fallback because parseSkillFile is synchronous
  const fs = require('fs');
  return fs.readFileSync(filePath, 'utf-8');
}
