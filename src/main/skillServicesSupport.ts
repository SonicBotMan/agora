import path from 'path';

export type SkillServiceEnv = Record<string, string | undefined>;

export type SkillServiceDirectoryEntry = {
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
};

export interface SkillServiceFileSystem {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf-8') => string;
  statSync: (path: string) => { mtimeMs: number };
  readdirSync: (
    path: string,
    options: { withFileTypes: true },
  ) => SkillServiceDirectoryEntry[];
}

export function resolveUserShellPath(deps: {
  platform: NodeJS.Platform;
  shell?: string;
  env: NodeJS.ProcessEnv;
  execSync: (command: string, options: {
    encoding: 'utf-8';
    timeout: number;
    env: NodeJS.ProcessEnv;
  }) => string;
}): string | null {
  if (deps.platform === 'win32') {
    return null;
  }

  try {
    const shell = deps.shell || '/bin/bash';
    const result = deps.execSync(`${shell} -lc 'echo __PATH__=$PATH'`, {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...deps.env },
    });
    const match = result.match(/__PATH__=(.+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    console.warn('[SkillServices] Failed to resolve user shell PATH:', error);
    return null;
  }
}

export function buildSkillServiceEnv(deps: {
  processEnv: NodeJS.ProcessEnv;
  isPackaged: boolean;
  homePath: string;
  resolveUserShellPath: () => string | null;
  electronNodeRuntimePath: string;
  appendPythonRuntimeToEnv: (env: SkillServiceEnv) => void;
}): SkillServiceEnv {
  const env: SkillServiceEnv = { ...deps.processEnv };

  if (deps.isPackaged) {
    if (!env.HOME) {
      env.HOME = deps.homePath;
    }

    const userPath = deps.resolveUserShellPath();
    if (userPath) {
      env.PATH = userPath;
      console.log('[SkillServices] Resolved user shell PATH for skill services');
    } else {
      const commonPaths = [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        `${env.HOME}/.nvm/current/bin`,
        `${env.HOME}/.volta/bin`,
        `${env.HOME}/.fnm/current/bin`,
      ];
      env.PATH = [env.PATH, ...commonPaths].filter(Boolean).join(':');
      console.log('[SkillServices] Using fallback PATH for skill services');
    }
  }

  env.LOBSTERAI_ELECTRON_PATH = deps.electronNodeRuntimePath;
  deps.appendPythonRuntimeToEnv(env);
  return env;
}

export function hasWebSearchRuntimeScriptSupport(
  skillPath: string,
  fileSystem: Pick<SkillServiceFileSystem, 'existsSync' | 'readFileSync'>,
): boolean {
  const startServerScript = path.join(skillPath, 'scripts', 'start-server.sh');
  const searchScript = path.join(skillPath, 'scripts', 'search.sh');
  if (!fileSystem.existsSync(startServerScript)) {
    return false;
  }
  if (!fileSystem.existsSync(searchScript)) {
    return false;
  }

  try {
    const startScript = fileSystem.readFileSync(startServerScript, 'utf-8');
    const searchScriptContent = fileSystem.readFileSync(searchScript, 'utf-8');
    return startScript.includes('WEB_SEARCH_FORCE_REPAIR')
      && startScript.includes('detect_healthy_bridge_server')
      && searchScriptContent.includes('ACTIVE_SERVER_URL')
      && searchScriptContent.includes('try_switch_to_local_server');
  } catch {
    return false;
  }
}

export function hasLegacyWebSearchEncodingHeuristic(
  serverEntry: string,
  fileSystem: Pick<SkillServiceFileSystem, 'readFileSync'>,
): boolean {
  try {
    const content = fileSystem.readFileSync(serverEntry, 'utf-8');
    return content.includes('scoreDecodedJsonText')
      && content.includes('Request body decoded using gb18030 (score');
  } catch {
    return true;
  }
}

export function isWebSearchDistOutdated(
  skillPath: string,
  fileSystem: SkillServiceFileSystem,
): boolean {
  const serverEntry = path.join(skillPath, 'dist', 'server', 'index.js');
  if (!fileSystem.existsSync(serverEntry)) {
    return true;
  }

  if (hasLegacyWebSearchEncodingHeuristic(serverEntry, fileSystem)) {
    return true;
  }

  const sourceDir = path.join(skillPath, 'server');
  if (!fileSystem.existsSync(sourceDir)) {
    return false;
  }

  let distMtimeMs = 0;
  try {
    distMtimeMs = fileSystem.statSync(serverEntry).mtimeMs;
  } catch {
    return true;
  }

  const queue: string[] = [sourceDir];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    let entries: SkillServiceDirectoryEntry[] = [];
    try {
      entries = fileSystem.readdirSync(current, { withFileTypes: true });
    } catch {
      return true;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.ts')) {
        continue;
      }

      try {
        if (fileSystem.statSync(fullPath).mtimeMs > distMtimeMs) {
          return true;
        }
      } catch {
        return true;
      }
    }
  }

  return false;
}

export function isWebSearchRuntimeHealthy(
  skillPath: string,
  fileSystem: SkillServiceFileSystem,
): boolean {
  const requiredPaths = [
    path.join(skillPath, 'scripts', 'start-server.sh'),
    path.join(skillPath, 'scripts', 'search.sh'),
    path.join(skillPath, 'dist', 'server', 'index.js'),
    path.join(skillPath, 'node_modules', 'iconv-lite', 'encodings', 'index.js'),
  ];
  return requiredPaths.every((requiredPath) => fileSystem.existsSync(requiredPath))
    && hasWebSearchRuntimeScriptSupport(skillPath, fileSystem)
    && !isWebSearchDistOutdated(skillPath, fileSystem);
}

export function hasCommand(deps: {
  command: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  spawnSync: (command: string, args: string[], options: {
    stdio: 'ignore';
    env: NodeJS.ProcessEnv;
    windowsHide: boolean;
  }) => { status: number | null };
}): boolean {
  const checker = deps.platform === 'win32' ? 'where' : 'which';
  const result = deps.spawnSync(checker, [deps.command], {
    stdio: 'ignore',
    env: deps.env,
    windowsHide: deps.platform === 'win32',
  });
  return result.status === 0;
}

export function resolveNodeRuntime(deps: {
  env: NodeJS.ProcessEnv;
  hasCommand: (command: string, env: NodeJS.ProcessEnv) => boolean;
  electronNodeRuntimePath: string;
}): { command: string; args: string[]; extraEnv?: NodeJS.ProcessEnv } {
  if (deps.hasCommand('node', deps.env)) {
    return { command: 'node', args: [] };
  }

  return {
    command: deps.electronNodeRuntimePath,
    args: [],
    extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
  };
}

export function resolveBundledWebSearchRepairPath(deps: {
  skillPath: string;
  isPackaged: boolean;
  resourcesPath: string;
  appPath: string;
  existsSync: (path: string) => boolean;
}): string | null {
  if (!deps.isPackaged) {
    return null;
  }

  const candidates = [
    path.join(deps.resourcesPath, 'SKILLs', 'web-search'),
    path.join(deps.appPath, 'SKILLs', 'web-search'),
  ];

  return candidates.find(
    (candidate) => candidate !== deps.skillPath && deps.existsSync(candidate),
  ) ?? null;
}

export function resolveWebSearchPath(deps: {
  isPackaged: boolean;
  userDataPath: string;
  resourcesPath: string;
  appPath: string;
  moduleDir: string;
  existsSync: (path: string) => boolean;
}): string | null {
  const candidates: string[] = [];

  if (deps.isPackaged) {
    candidates.push(path.join(deps.userDataPath, 'SKILLs', 'web-search'));
    candidates.push(path.join(deps.resourcesPath, 'SKILLs', 'web-search'));
    candidates.push(path.join(deps.appPath, 'SKILLs', 'web-search'));
  } else {
    const projectRoot = path.resolve(deps.moduleDir, '..');
    candidates.push(path.join(projectRoot, 'SKILLs', 'web-search'));
    candidates.push(path.join(deps.appPath, 'SKILLs', 'web-search'));
  }

  return candidates.find((skillPath) => deps.existsSync(skillPath)) ?? null;
}
