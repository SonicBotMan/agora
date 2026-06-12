import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./coworkEngineOpenClawSupport', () => ({
  createOpenClawEngineSupport: vi.fn(),
}));

vi.mock('./coworkEngineHermesSupport', () => ({
  createHermesEngineSupport: vi.fn(),
}));

import { createHermesEngineSupport } from './coworkEngineHermesSupport';
import { createOpenClawEngineSupport } from './coworkEngineOpenClawSupport';
import { createCoworkEngineRuntimeCompose } from './coworkEngineRuntimeComposeSupport';

describe('coworkEngineRuntimeComposeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes OpenClaw and Hermes engine supports with the expected dependency slices', () => {
    const deps = {
      getWindows: vi.fn(),
      getStore: vi.fn(),
      getCoworkStore: vi.fn(),
      getSkillManager: vi.fn(),
      getIMGatewayManager: vi.fn(),
      getFeishuRuntimeOwnership: vi.fn(),
      resolveFeishuIMAgentEngine: vi.fn(),
      getOpenClawRuntimeAdapter: vi.fn(),
      getCronJobService: vi.fn(),
      startMcpBridge: vi.fn(),
      getMcpBridgeConfig: vi.fn(),
      ensureDefaultIdentity: vi.fn(),
      getCoworkRuntimeForwarder: vi.fn(),
    };

    vi.mocked(createOpenClawEngineSupport).mockReturnValue(
      { openclawKey: 'openclaw' } as never,
    );
    vi.mocked(createHermesEngineSupport).mockReturnValue(
      { hermesKey: 'hermes' } as never,
    );

    expect(createCoworkEngineRuntimeCompose(deps as never)).toEqual({
      openclawKey: 'openclaw',
      hermesKey: 'hermes',
    });
    expect(createOpenClawEngineSupport).toHaveBeenCalledWith({
      getWindows: deps.getWindows,
      getStore: deps.getStore,
      getCoworkStore: deps.getCoworkStore,
      getSkillManager: deps.getSkillManager,
      getIMGatewayManager: deps.getIMGatewayManager,
      getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
      resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
      getOpenClawRuntimeAdapter: deps.getOpenClawRuntimeAdapter,
      getCronJobService: deps.getCronJobService,
      startMcpBridge: deps.startMcpBridge,
      getMcpBridgeConfig: deps.getMcpBridgeConfig,
      ensureDefaultIdentity: deps.ensureDefaultIdentity,
    });
    expect(createHermesEngineSupport).toHaveBeenCalledWith({
      getWindows: deps.getWindows,
      getCoworkStore: deps.getCoworkStore,
      getIMGatewayManager: deps.getIMGatewayManager,
      getFeishuRuntimeOwnership: deps.getFeishuRuntimeOwnership,
      getCoworkRuntimeForwarder: deps.getCoworkRuntimeForwarder,
      resolveFeishuIMAgentEngine: deps.resolveFeishuIMAgentEngine,
    });
  });
});
