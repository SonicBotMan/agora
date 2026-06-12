import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { cpRecursiveSync } from './fsCompat';

describe('fsCompat', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recursively copies nested directories and files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-fscompat-'));
    tempDirs.push(root);
    const src = path.join(root, 'src');
    const dest = path.join(root, 'dest');

    fs.mkdirSync(path.join(src, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(src, 'root.txt'), 'root');
    fs.writeFileSync(path.join(src, 'nested', 'child.txt'), 'child');

    cpRecursiveSync(src, dest);

    expect(fs.readFileSync(path.join(dest, 'root.txt'), 'utf8')).toBe('root');
    expect(fs.readFileSync(path.join(dest, 'nested', 'child.txt'), 'utf8')).toBe(
      'child',
    );
  });

  it('does not overwrite existing files unless force=true', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-fscompat-'));
    tempDirs.push(root);
    const src = path.join(root, 'src.txt');
    const dest = path.join(root, 'dest.txt');

    fs.writeFileSync(src, 'new');
    fs.writeFileSync(dest, 'old');

    cpRecursiveSync(src, dest);
    expect(fs.readFileSync(dest, 'utf8')).toBe('old');

    cpRecursiveSync(src, dest, { force: true });
    expect(fs.readFileSync(dest, 'utf8')).toBe('new');
  });
});
