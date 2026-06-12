import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import {
  buildSkillServiceEnv,
  hasCommand,
  isWebSearchDistOutdated,
  isWebSearchRuntimeHealthy,
  resolveBundledWebSearchRepairPath,
  resolveNodeRuntime,
  resolveUserShellPath,
  resolveWebSearchPath,
  type SkillServiceFileSystem,
} from './skillServicesSupport';

function createFileSystem(overrides: Partial<SkillServiceFileSystem> = {}): SkillServiceFileSystem {
  return {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(''),
    statSync: vi.fn().mockReturnValue({ mtimeMs: 100 }),
    readdirSync: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

describe('skillServicesSupport', () => {
  it('resolves the user shell PATH from a login shell marker', () => {
    const execSync = vi
      .fn()
      .mockReturnValue('__PATH__=/usr/local/bin:/opt/homebrew/bin\n');

    const result = resolveUserShellPath({
      platform: 'darwin',
      shell: '/bin/zsh',
      env: { PATH: '/usr/bin' },
      execSync,
    });

    expect(result).toBe('/usr/local/bin:/opt/homebrew/bin');
    expect(execSync).toHaveBeenCalledWith(
      "/bin/zsh -lc 'echo __PATH__=$PATH'",
      expect.objectContaining({
        encoding: 'utf-8',
        timeout: 5000,
      }),
    );
  });

  it('builds packaged skill service env with fallback PATH and python/electron runtime entries', () => {
    const appendPythonRuntimeToEnv = vi.fn((env) => {
      env.PYTHON_HOME = '/python/runtime';
    });

    const env = buildSkillServiceEnv({
      processEnv: { PATH: '/usr/bin' },
      isPackaged: true,
      homePath: '/Users/tester',
      resolveUserShellPath: () => null,
      electronNodeRuntimePath: '/electron/node',
      appendPythonRuntimeToEnv,
    });

    expect(env.HOME).toBe('/Users/tester');
    expect(env.PATH).toContain('/usr/bin');
    expect(env.PATH).toContain('/usr/local/bin');
    expect(env.PATH).toContain('/Users/tester/.volta/bin');
    expect(env.LOBSTERAI_ELECTRON_PATH).toBe('/electron/node');
    expect(env.PYTHON_HOME).toBe('/python/runtime');
    expect(appendPythonRuntimeToEnv).toHaveBeenCalledWith(env);
  });

  it('detects outdated web-search dist output when a source file is newer than the compiled entry', () => {
    const skillPath = '/skill';
    const serverEntry = path.join(skillPath, 'dist', 'server', 'index.js');
    const sourceDir = path.join(skillPath, 'server');
    const sourceFile = path.join(sourceDir, 'index.ts');
    const fileSystem = createFileSystem({
      readFileSync: vi.fn().mockImplementation((filePath: string) => {
        if (filePath === serverEntry) {
          return 'compiled content';
        }
        return '';
      }),
      statSync: vi.fn().mockImplementation((filePath: string) => {
        if (filePath === serverEntry) {
          return { mtimeMs: 100 };
        }
        if (filePath === sourceFile) {
          return { mtimeMs: 200 };
        }
        return { mtimeMs: 100 };
      }),
      readdirSync: vi.fn().mockImplementation((dirPath: string) => {
        if (dirPath === sourceDir) {
          return [
            {
              name: 'index.ts',
              isDirectory: () => false,
              isFile: () => true,
            },
          ];
        }
        return [];
      }),
    });

    expect(isWebSearchDistOutdated(skillPath, fileSystem)).toBe(true);
  });

  it('checks web-search runtime health from required files, script support, and dist freshness', () => {
    const skillPath = '/skill';
    const fileSystem = createFileSystem({
      readFileSync: vi.fn().mockImplementation((filePath: string) => {
        if (filePath.endsWith('start-server.sh')) {
          return 'WEB_SEARCH_FORCE_REPAIR\ndetect_healthy_bridge_server';
        }
        if (filePath.endsWith('search.sh')) {
          return 'ACTIVE_SERVER_URL\ntry_switch_to_local_server';
        }
        if (filePath.endsWith(path.join('dist', 'server', 'index.js'))) {
          return 'compiled content';
        }
        return '';
      }),
    });

    expect(isWebSearchRuntimeHealthy(skillPath, fileSystem)).toBe(true);
  });

  it('falls back to the Electron runtime when node is not available', () => {
    const runtime = resolveNodeRuntime({
      env: { PATH: '/usr/bin' },
      hasCommand: () => false,
      electronNodeRuntimePath: '/electron/node',
    });

    expect(runtime).toEqual({
      command: '/electron/node',
      args: [],
      extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
    });
  });

  it('checks command availability with the platform-specific lookup tool', () => {
    const spawnSync = vi.fn().mockReturnValue({ status: 0 });

    expect(
      hasCommand({
        command: 'node',
        env: { PATH: '/usr/bin' },
        platform: 'darwin',
        spawnSync,
      }),
    ).toBe(true);
    expect(spawnSync).toHaveBeenCalledWith('which', ['node'], {
      stdio: 'ignore',
      env: { PATH: '/usr/bin' },
      windowsHide: false,
    });
  });

  it('resolves packaged and development web-search skill paths in the expected precedence order', () => {
    expect(
      resolveBundledWebSearchRepairPath({
        skillPath: '/user/SKILLs/web-search',
        isPackaged: true,
        resourcesPath: '/resources',
        appPath: '/app',
        existsSync: (filePath) => filePath === '/resources/SKILLs/web-search',
      }),
    ).toBe('/resources/SKILLs/web-search');

    expect(
      resolveWebSearchPath({
        isPackaged: true,
        userDataPath: '/user',
        resourcesPath: '/resources',
        appPath: '/app',
        moduleDir: '/project/dist-electron',
        existsSync: (filePath) => filePath === '/user/SKILLs/web-search',
      }),
    ).toBe('/user/SKILLs/web-search');

    expect(
      resolveWebSearchPath({
        isPackaged: false,
        userDataPath: '/user',
        resourcesPath: '/resources',
        appPath: '/app',
        moduleDir: '/project/dist-electron',
        existsSync: (filePath) => filePath === '/project/SKILLs/web-search',
      }),
    ).toBe('/project/SKILLs/web-search');
  });
});
