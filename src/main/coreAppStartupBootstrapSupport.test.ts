import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import {
  ensureDefaultProjectDirectory,
  registerLocalfileProtocol,
  resetStartupRuntimeState,
} from './coreAppStartupBootstrapSupport';

describe('coreAppStartupBootstrapSupport', () => {
  it('creates the default project directory when it does not exist', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fileSystem = {
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
    };

    const projectDir = ensureDefaultProjectDirectory('/Users/tester', fileSystem);

    expect(projectDir).toBe(path.join('/Users/tester', 'agora', 'project'));
    expect(fileSystem.mkdirSync).toHaveBeenCalledWith(projectDir, {
      recursive: true,
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Created default project directory:',
      projectDir,
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[Main] initApp: default project dir ensured',
    );

    logSpy.mockRestore();
  });

  it('registers a localfile protocol handler that decodes file paths before fetching', () => {
    let registeredHandler: ((request: { url: string }) => unknown) | undefined;
    const protocolHost = {
      handle: vi.fn((scheme, handler) => {
        expect(scheme).toBe('localfile');
        registeredHandler = handler;
      }),
    };
    const fetchResult = { ok: true };
    const netHost = {
      fetch: vi.fn().mockReturnValue(fetchResult),
    };

    registerLocalfileProtocol(protocolHost, netHost);

    expect(registeredHandler).toBeTypeOf('function');
    expect(
      registeredHandler?.({ url: 'localfile:///tmp/test%20file.txt' }),
    ).toBe(fetchResult);
    expect(netHost.fetch).toHaveBeenCalledWith('file:///tmp/test file.txt');
  });

  it('resets startup runtime state and reports the reset counts', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const resetRunningSessions = vi.fn().mockReturnValue(2);
    const resetRunningCalls = vi.fn().mockReturnValue(3);

    const result = resetStartupRuntimeState({
      getCoworkStore: () => ({
        resetRunningSessions,
      }),
      getRuntimeTelemetryStore: () => ({
        resetRunningCalls,
      }),
    });

    expect(result).toEqual({
      resetCount: 2,
      resetRuntimeCallCount: 3,
    });
    expect(logSpy).toHaveBeenCalledWith(
      '[Main] initApp: resetRunningSessions done, count:',
      2,
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[Main] Reset 2 stuck cowork session(s) from running -> idle',
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[Main] Reset 3 stale runtime call(s) from running -> stopped',
    );

    logSpy.mockRestore();
  });
});
