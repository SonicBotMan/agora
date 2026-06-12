import { describe, expect, it, vi } from 'vitest';

vi.mock('./mainBootstrapIpcRuntimeImSupport', () => ({
  createMainIpcRuntimeImBuilderDeps: vi.fn(),
}));

vi.mock('./mainBootstrapIpcRuntimeServiceSupport', () => ({
  createMainIpcRuntimeServiceBuilderDeps: vi.fn(),
}));

vi.mock('./mainBootstrapIpcRuntimeSessionSupport', () => ({
  createMainIpcRuntimeSessionBuilderDeps: vi.fn(),
}));

vi.mock('./mainBootstrapIpcRuntimeHelperSupport', () => ({
  getEngineNotReadyResponse: vi.fn(),
  mergeCoworkSystemPrompt: vi.fn(),
  isExternalAgentProviderAppType: vi.fn(),
}));

vi.mock('./libs/externalAgentConfigSync', () => ({
  importLocalAgentConfigToModelSettings: vi.fn(),
  syncDeepSeekTuiGlobalConfigFromAgoraModel: vi.fn(),
  syncOpenCodeGlobalConfigFromAgoraModel: vi.fn(),
}));

import {
  importLocalAgentConfigToModelSettings,
  syncDeepSeekTuiGlobalConfigFromAgoraModel,
  syncOpenCodeGlobalConfigFromAgoraModel,
} from './libs/externalAgentConfigSync';
import {
  getEngineNotReadyResponse,
  isExternalAgentProviderAppType,
  mergeCoworkSystemPrompt,
} from './mainBootstrapIpcRuntimeHelperSupport';
import { createMainIpcRuntimeImBuilderDeps } from './mainBootstrapIpcRuntimeImSupport';
import { createMainIpcRuntimeServiceBuilderDeps } from './mainBootstrapIpcRuntimeServiceSupport';
import { createMainIpcRuntimeSessionBuilderDeps } from './mainBootstrapIpcRuntimeSessionSupport';
import { createMainIpcRuntimeBuilderDeps } from './mainBootstrapIpcRuntimeSupport';

describe('mainBootstrapIpcRuntimeSupport', () => {
  it('composes session, IM, and service builder deps with shared helpers', () => {
    vi.mocked(createMainIpcRuntimeSessionBuilderDeps).mockReturnValue({
      sessionKey: 'session',
    } as never);
    vi.mocked(createMainIpcRuntimeImBuilderDeps).mockReturnValue({
      imKey: 'im',
    } as never);
    vi.mocked(createMainIpcRuntimeServiceBuilderDeps).mockReturnValue({
      serviceKey: 'service',
    } as never);

    const deps = createMainIpcRuntimeBuilderDeps({ name: 'wiring' } as never);

    expect(createMainIpcRuntimeSessionBuilderDeps).toHaveBeenCalledWith(
      { name: 'wiring' },
      {
        getEngineNotReadyResponse,
        mergeCoworkSystemPrompt,
        importLocalAgentConfigToModelSettings,
        isExternalAgentProviderAppType,
      },
    );
    expect(createMainIpcRuntimeImBuilderDeps).toHaveBeenCalledWith({
      name: 'wiring',
    });
    expect(createMainIpcRuntimeServiceBuilderDeps).toHaveBeenCalledWith({
      name: 'wiring',
    });
    expect(deps).toEqual({
      sessionKey: 'session',
      imKey: 'im',
      serviceKey: 'service',
      syncOpenCodeGlobalConfigFromAgoraModel,
      syncDeepSeekTuiGlobalConfigFromAgoraModel,
    });
  });
});
