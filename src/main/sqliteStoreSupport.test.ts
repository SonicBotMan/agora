import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import {
  createMemoryFingerprint,
  getLegacyMemoryCandidates,
  parseLegacyMemoryEntries,
  tryReadLegacyMemoryText,
} from './sqliteStoreSupport';

describe('sqliteStoreSupport', () => {
  it('builds legacy memory candidate paths from cwd and app path', () => {
    expect(getLegacyMemoryCandidates('/workspace', '/app')).toEqual([
      path.join('/workspace', 'MEMORY.md'),
      path.join('/app', 'MEMORY.md'),
      path.join('/workspace', 'memory.md'),
      path.join('/app', 'memory.md'),
    ]);
  });

  it('reads the first readable legacy memory file candidate', () => {
    const candidates = ['/a/MEMORY.md', '/b/memory.md'];
    const fileSystem = {
      existsSync: vi.fn((filePath: string) => filePath === '/b/memory.md'),
      statSync: vi.fn().mockReturnValue({ isFile: () => true }),
      readFileSync: vi.fn().mockReturnValue('- remembers things'),
    };

    expect(tryReadLegacyMemoryText(candidates, fileSystem)).toBe(
      '- remembers things',
    );
    expect(fileSystem.readFileSync).toHaveBeenCalledWith('/b/memory.md', 'utf8');
  });

  it('parses legacy memory bullet entries with dedupe, filtering, and truncation', () => {
    const longText = 'x'.repeat(400);
    const raw = `
- remembers coffee order
- REMEMBERS COFFEE ORDER
- (empty)
- short
\
\`\`\`md
- should be ignored from code block
\`\`\`
- [tag] ${longText}
`;

    expect(parseLegacyMemoryEntries(raw)).toEqual([
      'remembers coffee order',
      `${longText.slice(0, 359)}…`,
    ]);
  });

  it('normalizes memory text before generating the fingerprint', () => {
    expect(createMemoryFingerprint('Hello,   World!')).toBe(
      createMemoryFingerprint('hello world'),
    );
    expect(createMemoryFingerprint('Hello,   World!')).not.toBe(
      createMemoryFingerprint('different memory'),
    );
  });
});
