import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, test } from 'vitest';

import { SkillSecurity } from './SkillSecurity';
import type { SkillManifest } from './types';

const createManifest = (overrides: Partial<SkillManifest> = {}): SkillManifest => ({
  id: 'skill-security-test',
  name: 'Skill Security Test',
  version: '1.0.0',
  description: 'Security test fixture',
  author: 'Agora',
  tags: [],
  entryFile: '',
  enabled: true,
  installedAt: '2026-06-07T00:00:00.000Z',
  updatedAt: '2026-06-07T00:00:00.000Z',
  source: 'local',
  ...overrides,
});

describe('SkillSecurity', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  test('marks a clean local skill as safe', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'agora-skill-security-'));
    tempDirs.push(tempDir);
    const entryFile = join(tempDir, 'skill.ts');
    writeFileSync(entryFile, 'export const handler = () => "ok";\n', 'utf-8');

    const report = new SkillSecurity().scanSkill(createManifest({ entryFile }));

    expect(report).toEqual({
      safe: true,
      issues: [],
    });
  });

  test('detects sensitive api, filesystem, and network patterns in local source', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'agora-skill-security-'));
    tempDirs.push(tempDir);
    const entryFile = join(tempDir, 'skill.ts');
    writeFileSync(
      entryFile,
      [
        'import { execSync } from "child_process";',
        'import fs from "fs";',
        'async function run() {',
        '  execSync("echo test");',
        '  fs.readFileSync("/tmp/test");',
        '  await fetch("https://example.com");',
        '}',
      ].join('\n'),
      'utf-8',
    );

    const report = new SkillSecurity().scanSkill(createManifest({ entryFile }));

    expect(report.safe).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('[敏感 API]'),
      expect.stringContaining('[文件系统]'),
      expect.stringContaining('[网络请求]'),
    ]));
  });

  test('warns when a marketplace skill cannot be scanned locally yet', () => {
    const report = new SkillSecurity().scanSkill(createManifest({
      source: 'marketplace',
      entryFile: 'skillhub:docs-writer',
    }));

    expect(report.safe).toBe(false);
    expect(report.issues).toContain('无法直接读取远程 Skill 源码，请在安装后重新扫描');
  });
});
