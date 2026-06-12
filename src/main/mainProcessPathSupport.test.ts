import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configureUserDataPath,
  normalizeShellPathForPlatform,
} from './mainProcessPathSupport';

describe('mainProcessPathSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates userData path to the preferred app-scoped directory only when needed', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = {
      getPath: vi.fn((key: string) => {
        if (key === 'appData') return '/Users/test/Library/Application Support';
        if (key === 'userData') return '/tmp/old-user-data';
        return '';
      }),
      setPath: vi.fn(),
    };

    configureUserDataPath(app as never);

    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      '/Users/test/Library/Application Support/Agora',
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[Main] userData path updated: /tmp/old-user-data -> /Users/test/Library/Application Support/Agora',
    );

    logSpy.mockRestore();
  });

  it('leaves userData path unchanged when it already matches the preferred path', () => {
    const app = {
      getPath: vi.fn((key: string) => {
        if (key === 'appData') return '/Users/test/Library/Application Support';
        if (key === 'userData') {
          return '/Users/test/Library/Application Support/Agora';
        }
        return '';
      }),
      setPath: vi.fn(),
    };

    configureUserDataPath(app as never);

    expect(app.setPath).not.toHaveBeenCalled();
  });

  it('normalizes Windows shell paths from file URLs, unix-drive paths, and mixed separators', () => {
    expect(normalizeShellPathForPlatform('/usr/local/bin/bash', false)).toBe(
      '/usr/local/bin/bash',
    );
    expect(
      normalizeShellPathForPlatform(
        'file:///C:/Program%20Files/Git/bin/bash.exe',
        true,
      ),
    ).toBe('C:\\Program Files\\Git\\bin\\bash.exe');
    expect(normalizeShellPathForPlatform('/c/Users/test/bin/bash', true)).toBe(
      'C:\\Users\\test\\bin\\bash',
    );
    expect(normalizeShellPathForPlatform('/D:/Tools/bash.exe', true)).toBe(
      'D:\\Tools\\bash.exe',
    );
    expect(normalizeShellPathForPlatform('e:/tools/bash.exe', true)).toBe(
      'E:\\tools\\bash.exe',
    );
    expect(normalizeShellPathForPlatform('   ', true)).toBe('   ');
  });
});
