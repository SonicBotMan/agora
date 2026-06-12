import { describe, expect, it, vi } from 'vitest';

import { createMainIpcRuntimeImHandlerDeps } from './mainIpcRuntimeImSupport';

function createDeps() {
  const store = { id: 'store' };
  const imGatewayManager = { id: 'im-gateway-manager' };
  const deps = {
    getStore: vi.fn().mockReturnValue(store),
    getCoworkStore: vi.fn().mockReturnValue({ id: 'cowork-store' }),
    getIMGatewayManager: vi.fn().mockReturnValue(imGatewayManager),
    getOpenClawEngineManager: vi.fn().mockReturnValue({ id: 'openclaw' }),
    getHermesEngineManager: vi.fn().mockReturnValue({ id: 'hermes' }),
    getOpenClawConfigSync: vi.fn().mockReturnValue({ id: 'openclaw-config-sync' }),
    getHermesConfigSync: vi.fn().mockReturnValue({ id: 'hermes-config-sync' }),
    openClawRuntimeAdapter: { id: 'openclaw-runtime-adapter' },
    syncOpenClawConfig: vi.fn().mockResolvedValue({
      success: true,
      changed: 0,
    }),
    resolveFeishuIMAgentEngine: vi.fn().mockReturnValue('hermes'),
    isFeishuEngineManagedByAgora: vi.fn().mockReturnValue(true),
    normalizeFeishuEngineKey: vi.fn().mockReturnValue(123),
    getFeishuRuntimeOwnership: vi.fn().mockReturnValue(456),
    getFeishuRuntimeOwnershipStatus: vi.fn().mockReturnValue({ status: 'ok' }),
    transferFeishuToLocalRuntime: vi.fn().mockResolvedValue({ moved: 'local' }),
    transferFeishuToAgoraRuntime: vi.fn().mockResolvedValue({ moved: 'agora' }),
    detectLocalOpenClawFeishu: vi.fn().mockReturnValue({ configured: true }),
    importOpenClawLocalFeishuConfig: vi.fn().mockReturnValue({ success: true }),
    listPairingRequests: vi.fn().mockReturnValue([{ code: '123456' }]),
    readAllowFromStore: vi.fn().mockReturnValue(['user-1']),
    approvePairingCode: vi.fn().mockReturnValue(1),
    rejectPairingRequest: vi.fn().mockReturnValue(0),
    startHermesIMSessionSyncPolling: vi.fn(),
    syncHermesIMSessionsToCowork: vi.fn(),
  };

  return {
    deps,
    store,
    imGatewayManager,
  };
}

describe('mainIpcRuntimeImSupport', () => {
  it('builds IM handler deps and normalizes wrapped runtime results', async () => {
    const { deps, store, imGatewayManager } = createDeps();
    const handlerDeps = createMainIpcRuntimeImHandlerDeps(deps as never);

    expect(handlerDeps.getStore()).toBe(store);
    expect(handlerDeps.getCoworkStore).toBe(deps.getCoworkStore);
    expect(handlerDeps.getIMGatewayManager()).toBe(imGatewayManager);
    expect(handlerDeps.getOpenClawEngineManager).toBe(
      deps.getOpenClawEngineManager,
    );
    expect(handlerDeps.getHermesEngineManager).toBe(
      deps.getHermesEngineManager,
    );
    expect(handlerDeps.getOpenClawConfigSync).toBe(deps.getOpenClawConfigSync);
    expect(handlerDeps.getHermesConfigSync).toBe(deps.getHermesConfigSync);
    expect(handlerDeps.openClawRuntimeAdapter).toBe(deps.openClawRuntimeAdapter);

    await expect(
      handlerDeps.syncOpenClawConfig({ reason: 'manual' }),
    ).resolves.toEqual({
      success: true,
      changed: false,
    });
    expect(deps.syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'manual',
    });

    expect(handlerDeps.resolveFeishuIMAgentEngine).toBe(
      deps.resolveFeishuIMAgentEngine,
    );
    expect(handlerDeps.isFeishuEngineManagedByAgora('codex')).toBe(true);
    expect(handlerDeps.normalizeFeishuEngineKey('value')).toBe('123');
    expect(handlerDeps.getFeishuRuntimeOwnership('value')).toBe('456');
    expect(
      handlerDeps.getFeishuRuntimeOwnershipStatus('key', 'ownership'),
    ).toEqual({ status: 'ok' });

    await expect(
      handlerDeps.transferFeishuToLocalRuntime('key', [], {}),
    ).resolves.toEqual({ moved: 'local' });
    await expect(
      handlerDeps.transferFeishuToAgoraRuntime('key'),
    ).resolves.toEqual({ moved: 'agora' });

    expect(handlerDeps.detectLocalOpenClawFeishu()).toEqual({
      configured: true,
    });
    expect(handlerDeps.importOpenClawLocalFeishuConfig()).toEqual({
      success: true,
    });
    expect(handlerDeps.listPairingRequests('telegram', '/tmp/state')).toEqual([
      { code: '123456' },
    ]);
    expect(handlerDeps.readAllowFromStore('telegram', '/tmp/state')).toEqual([
      'user-1',
    ]);
    expect(handlerDeps.approvePairingCode('telegram', '123456', '/tmp')).toBe(
      true,
    );
    expect(handlerDeps.rejectPairingRequest('telegram', '123456', '/tmp')).toBe(
      false,
    );
    expect(handlerDeps.startHermesIMSessionSyncPolling).toBe(
      deps.startHermesIMSessionSyncPolling,
    );
    expect(handlerDeps.syncHermesIMSessionsToCowork).toBe(
      deps.syncHermesIMSessionsToCowork,
    );
  });
});
