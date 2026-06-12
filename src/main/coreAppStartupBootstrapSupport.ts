import path from 'path';

export interface DefaultProjectDirectoryFileSystem {
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options: { recursive: true }) => void;
}

export interface LocalfileProtocolHost {
  handle: (scheme: string, handler: (request: { url: string }) => unknown) => void;
}

export interface LocalfileNetHost {
  fetch: (url: string) => unknown;
}

export interface StartupRuntimeStateResetDeps {
  getCoworkStore: () => {
    resetRunningSessions: () => number;
  };
  getRuntimeTelemetryStore: () => {
    resetRunningCalls: () => number;
  };
}

export function ensureDefaultProjectDirectory(
  homeDir: string,
  fileSystem: DefaultProjectDirectoryFileSystem,
): string {
  const defaultProjectDir = path.join(homeDir, 'agora', 'project');
  if (!fileSystem.existsSync(defaultProjectDir)) {
    fileSystem.mkdirSync(defaultProjectDir, { recursive: true });
    console.log('Created default project directory:', defaultProjectDir);
  }
  console.log('[Main] initApp: default project dir ensured');
  return defaultProjectDir;
}

export function registerLocalfileProtocol(
  protocolHost: LocalfileProtocolHost,
  netHost: LocalfileNetHost,
): void {
  protocolHost.handle('localfile', (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);
    return netHost.fetch(`file://${filePath}`);
  });
}

export function resetStartupRuntimeState(
  deps: StartupRuntimeStateResetDeps,
): { resetCount: number; resetRuntimeCallCount: number } {
  const resetCount = deps.getCoworkStore().resetRunningSessions();
  console.log('[Main] initApp: resetRunningSessions done, count:', resetCount);
  if (resetCount > 0) {
    console.log(
      `[Main] Reset ${resetCount} stuck cowork session(s) from running -> idle`,
    );
  }

  const resetRuntimeCallCount =
    deps.getRuntimeTelemetryStore().resetRunningCalls();
  if (resetRuntimeCallCount > 0) {
    console.log(
      `[Main] Reset ${resetRuntimeCallCount} stale runtime call(s) from running -> stopped`,
    );
  }

  return {
    resetCount,
    resetRuntimeCallCount,
  };
}
