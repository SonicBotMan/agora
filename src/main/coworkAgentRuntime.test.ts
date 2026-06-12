import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ClaudeCodePermissionMode,
  CoworkAgentEngine,
  CoworkIpcChannel,
  DeepSeekTuiPermissionMode,
  ExternalAgentConfigSource,
  OpenCodePermissionMode,
} from '../shared/cowork/constants';
import { createCoworkAgentRuntime } from './coworkAgentRuntime';
import type { CoworkConfig } from './coworkStore';
import type { ExternalAgentCliInstallProgress } from './libs/externalAgentCliInstaller';

type MockAgentManagerInstance = {
  store: unknown;
  getAgent: ReturnType<typeof vi.fn>;
};

const { agentManagerInstances, mockGetAgentImpl } = vi.hoisted(() => ({
  agentManagerInstances: [] as MockAgentManagerInstance[],
  mockGetAgentImpl: vi.fn(),
}));

vi.mock('./agentManager', () => ({
  AgentManager: class {
    store: unknown;
    getAgent: ReturnType<typeof vi.fn>;

    constructor(store: unknown) {
      this.store = store;
      this.getAgent = vi.fn((agentId: string) => mockGetAgentImpl(agentId));
      agentManagerInstances.push(this as MockAgentManagerInstance);
    }
  },
}));

const createConfig = (overrides: Partial<CoworkConfig> = {}): CoworkConfig => ({
  workingDirectory: '/workspace',
  systemPrompt: '',
  executionMode: 'local',
  agentEngine: CoworkAgentEngine.ClaudeCode,
  openclawConfigSource: ExternalAgentConfigSource.AgoraModel,
  claudeCodeConfigSource: ExternalAgentConfigSource.LocalCli,
  claudeCodePermissionMode: ClaudeCodePermissionMode.Default,
  codexConfigSource: ExternalAgentConfigSource.AgoraModel,
  hermesConfigSource: ExternalAgentConfigSource.LocalCli,
  opencodeConfigSource: ExternalAgentConfigSource.LocalCli,
  opencodePermissionMode: OpenCodePermissionMode.Auto,
  deepseekTuiConfigSource: ExternalAgentConfigSource.AgoraModel,
  deepseekTuiPermissionMode: DeepSeekTuiPermissionMode.Auto,
  memoryEnabled: true,
  memoryImplicitUpdateEnabled: true,
  memoryLlmJudgeEnabled: true,
  memoryGuardLevel: 'strict',
  memoryUserMemoriesMaxItems: 50,
  ...overrides,
});

const createRuntimeDeps = (configOverrides: Partial<CoworkConfig> = {}) => {
  const config = createConfig(configOverrides);
  const store = {
    getConfig: vi.fn().mockReturnValue(config),
  };
  const activeSend = vi.fn();
  const destroyedSend = vi.fn();
  const installer = {
    onProgress: vi.fn(),
  };
  let progressListener:
    | ((progress: ExternalAgentCliInstallProgress) => void)
    | null = null;

  installer.onProgress.mockImplementation(
    (listener: (progress: ExternalAgentCliInstallProgress) => void) => {
      progressListener = listener;
      return vi.fn();
    },
  );

  const hermesEngineManager = {
    reportInstallProgress: vi.fn(),
  };
  const hermesConfigSync = {
    sync: vi.fn(),
  };
  const ensureOpenClawRunningForCowork = vi.fn();
  const ensureHermesRunningForCowork = vi.fn();
  const applyExternalAgentConfigForEngine = vi.fn();

  const runtime = createCoworkAgentRuntime({
    getWindows: () => [
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: activeSend },
      } as never,
      {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: destroyedSend },
      } as never,
    ],
    getCoworkStore: () => store as never,
    getExternalAgentCliInstaller: () => installer as never,
    getHermesEngineManager: () => hermesEngineManager as never,
    getHermesConfigSync: () => hermesConfigSync as never,
    ensureOpenClawRunningForCowork,
    ensureHermesRunningForCowork,
    applyExternalAgentConfigForEngine,
  });

  return {
    runtime,
    store,
    installer,
    activeSend,
    destroyedSend,
    hermesEngineManager,
    hermesConfigSync,
    ensureOpenClawRunningForCowork,
    ensureHermesRunningForCowork,
    applyExternalAgentConfigForEngine,
    emitProgress: (progress: ExternalAgentCliInstallProgress): void => {
      if (!progressListener) {
        throw new Error('Progress listener has not been registered.');
      }
      progressListener(progress);
    },
  };
};

describe('coworkAgentRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentImpl.mockReset();
    agentManagerInstances.length = 0;
  });

  it('lazily creates AgentManager and reuses the same instance', () => {
    const { runtime, store } = createRuntimeDeps();

    expect(agentManagerInstances).toHaveLength(0);
    expect(runtime.resolveCoworkAgentEngine()).toBe(CoworkAgentEngine.ClaudeCode);
    expect(agentManagerInstances).toHaveLength(0);

    const first = runtime.getAgentManager();
    const second = runtime.getAgentManager();

    expect(first).toBe(second);
    expect(agentManagerInstances).toHaveLength(1);
    expect(agentManagerInstances[0]?.store).toBe(store);
  });

  it('resolves workspace and agent runtime engines with safe fallback', () => {
    const { runtime } = createRuntimeDeps({
      agentEngine: 'invalid-engine' as CoworkConfig['agentEngine'],
    });

    expect(runtime.resolveCoworkAgentEngine()).toBe(CoworkAgentEngine.ClaudeCode);
    expect(runtime.resolveAgentRuntimeEngine()).toBe(CoworkAgentEngine.ClaudeCode);
    expect(runtime.resolveAgentRuntimeEngine('main')).toBe(CoworkAgentEngine.ClaudeCode);

    mockGetAgentImpl
      .mockReturnValueOnce({ agentEngine: CoworkAgentEngine.Codex })
      .mockReturnValueOnce({ agentEngine: 'unknown-engine' })
      .mockReturnValueOnce(null);

    expect(runtime.resolveAgentRuntimeEngine('agent-codex')).toBe(
      CoworkAgentEngine.Codex,
    );
    expect(runtime.resolveAgentRuntimeEngine('agent-invalid')).toBe(
      CoworkAgentEngine.ClaudeCode,
    );
    expect(runtime.resolveAgentRuntimeEngine('missing-agent')).toBe(
      CoworkAgentEngine.ClaudeCode,
    );
    expect(agentManagerInstances).toHaveLength(1);
    expect(agentManagerInstances[0]?.getAgent).toHaveBeenCalledTimes(3);
  });

  it('binds external CLI installer progress once and forwards it to live windows', () => {
    const { runtime, installer, emitProgress, activeSend, destroyedSend, hermesEngineManager } =
      createRuntimeDeps();
    const progress: ExternalAgentCliInstallProgress = {
      appType: 'codex',
      phase: 'installing',
      message: 'Installing Codex CLI',
    };

    runtime.bindExternalAgentCliInstallerForwarder();
    runtime.bindExternalAgentCliInstallerForwarder();
    emitProgress(progress);

    expect(installer.onProgress).toHaveBeenCalledTimes(1);
    expect(hermesEngineManager.reportInstallProgress).not.toHaveBeenCalled();
    expect(activeSend).toHaveBeenCalledWith(
      CoworkIpcChannel.AgentCliInstallProgress,
      progress,
    );
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it('reports Hermes install progress to the Hermes engine manager', () => {
    const { runtime, emitProgress, activeSend, hermesEngineManager } =
      createRuntimeDeps();
    const progress: ExternalAgentCliInstallProgress = {
      appType: 'hermes',
      phase: 'success',
      message: 'Hermes Agent installed',
      detail: 'v1.2.3',
    };

    runtime.bindExternalAgentCliInstallerForwarder();
    emitProgress(progress);

    expect(hermesEngineManager.reportInstallProgress).toHaveBeenCalledWith(
      progress,
    );
    expect(activeSend).toHaveBeenCalledWith(
      CoworkIpcChannel.AgentCliInstallProgress,
      progress,
    );
  });

  it('applies external agent config sources to the expected engine runtime', () => {
    const {
      runtime,
      applyExternalAgentConfigForEngine,
      hermesConfigSync,
    } = createRuntimeDeps({
      claudeCodeConfigSource: ExternalAgentConfigSource.LocalCli,
      codexConfigSource: ExternalAgentConfigSource.AgoraModel,
      opencodeConfigSource: ExternalAgentConfigSource.LocalCli,
      deepseekTuiConfigSource: ExternalAgentConfigSource.AgoraModel,
    });

    runtime.applyExternalAgentConfigSourceForEngine(CoworkAgentEngine.OpenClaw);
    runtime.applyExternalAgentConfigSourceForEngine(CoworkAgentEngine.ClaudeCode);
    runtime.applyExternalAgentConfigSourceForEngine(CoworkAgentEngine.Codex);
    runtime.applyExternalAgentConfigSourceForEngine(CoworkAgentEngine.Hermes);
    runtime.applyExternalAgentConfigSourceForEngine(CoworkAgentEngine.OpenCode);
    runtime.applyExternalAgentConfigSourceForEngine(CoworkAgentEngine.DeepSeekTui);

    expect(applyExternalAgentConfigForEngine.mock.calls).toEqual([
      [CoworkAgentEngine.ClaudeCode, ExternalAgentConfigSource.LocalCli],
      [CoworkAgentEngine.Codex, ExternalAgentConfigSource.AgoraModel],
      [CoworkAgentEngine.OpenCode, ExternalAgentConfigSource.LocalCli],
      [CoworkAgentEngine.DeepSeekTui, ExternalAgentConfigSource.AgoraModel],
    ]);
    expect(hermesConfigSync.sync).toHaveBeenCalledWith(
      'external-agent-config-source',
    );
  });

  it('returns success when OpenClaw and Hermes runtimes are already running', async () => {
    const { runtime, ensureOpenClawRunningForCowork, ensureHermesRunningForCowork } =
      createRuntimeDeps();

    ensureOpenClawRunningForCowork.mockResolvedValue({
      phase: 'running',
      version: '1.0.0',
      canRetry: false,
    });
    ensureHermesRunningForCowork.mockResolvedValue({
      phase: 'running',
      version: '2.0.0',
      canRetry: false,
    });

    await expect(
      runtime.ensureCoworkEngineReady(CoworkAgentEngine.OpenClaw),
    ).resolves.toEqual({ success: true });
    await expect(
      runtime.ensureCoworkEngineReady(CoworkAgentEngine.Hermes),
    ).resolves.toEqual({ success: true });
  });

  it('returns not-ready details when OpenClaw or Hermes cannot start', async () => {
    const { runtime, ensureOpenClawRunningForCowork, ensureHermesRunningForCowork } =
      createRuntimeDeps();
    const openClawStatus = {
      phase: 'error',
      version: null,
      canRetry: true,
      message: 'OpenClaw gateway failed to start.',
    };
    const hermesStatus = {
      phase: 'ready',
      version: '2.0.0',
      canRetry: false,
    };

    ensureOpenClawRunningForCowork.mockResolvedValue(openClawStatus);
    ensureHermesRunningForCowork.mockResolvedValue(hermesStatus);

    await expect(
      runtime.ensureCoworkEngineReady(CoworkAgentEngine.OpenClaw),
    ).resolves.toEqual({
      success: false,
      error: 'OpenClaw gateway failed to start.',
      engineStatus: openClawStatus,
    });
    await expect(
      runtime.ensureCoworkEngineReady(CoworkAgentEngine.Hermes),
    ).resolves.toEqual({
      success: false,
      error: 'Hermes runtime is not ready.',
      engineStatus: hermesStatus,
    });
  });
});
