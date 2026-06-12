import { describe, expect, it, vi } from 'vitest';

vi.mock('./logger', () => ({
  initLogger: vi.fn(),
}));

import { normalizeShellPathForPlatform } from './mainProcessEnvironment';

describe('normalizeShellPathForPlatform', () => {
  it('returns original path on non-Windows platforms', () => {
    expect(normalizeShellPathForPlatform('/tmp/demo', false)).toBe('/tmp/demo');
  });

  it('normalizes file URLs for Windows shells', () => {
    expect(
      normalizeShellPathForPlatform(
        'file:///C:/Users/test/project',
        true,
      ),
    ).toBe('C:\\Users\\test\\project');
  });

  it('normalizes unix-style drive paths for Windows shells', () => {
    expect(
      normalizeShellPathForPlatform('/c/workspace/agora', true),
    ).toBe('C:\\workspace\\agora');
  });
});
