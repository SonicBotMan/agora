import { describe, expect, it, vi } from 'vitest';

vi.mock('./im/imPairingStore', () => ({
  approvePairingCode: vi.fn(),
  listPairingRequests: vi.fn(),
  readAllowFromStore: vi.fn(),
  rejectPairingRequest: vi.fn(),
}));

vi.mock('./libs/feishuLocalRuntimeManager', () => ({
  getFeishuRuntimeOwnershipStatus: vi.fn(),
  transferFeishuToAgoraRuntime: vi.fn(),
  transferFeishuToLocalRuntime: vi.fn(),
}));

vi.mock('./libs/openclawSystemRuntime', () => ({
  importOpenClawLocalFeishuConfig: vi.fn(),
}));

import {
  approvePairingCode,
  listPairingRequests,
  readAllowFromStore,
  rejectPairingRequest,
} from './im/imPairingStore';
import {
  getFeishuRuntimeOwnershipStatus,
  transferFeishuToAgoraRuntime,
  transferFeishuToLocalRuntime,
} from './libs/feishuLocalRuntimeManager';
import { importOpenClawLocalFeishuConfig } from './libs/openclawSystemRuntime';
import { createMainIpcRuntimeImBuilderDeps } from './mainBootstrapIpcRuntimeImSupport';

describe('mainBootstrapIpcRuntimeImSupport', () => {
  it('maps IM runtime dependencies and external helpers', () => {
    const openClawRuntimeAdapter = { id: 'openclaw-adapter' };
    const runtime = {
      getStore: vi.fn(),
      getCoworkStore: vi.fn(),
      getIMGatewayManager: vi.fn(),
      getOpenClawEngineManager: vi.fn(),
      getHermesEngineManager: vi.fn(),
      getOpenClawConfigSync: vi.fn(),
      getHermesConfigSync: vi.fn(),
      peekOpenClawRuntimeAdapter: vi.fn().mockReturnValue(openClawRuntimeAdapter),
      syncOpenClawConfig: vi.fn(),
      resolveFeishuIMAgentEngine: vi.fn(),
      isFeishuEngineManagedByAgora: vi.fn(),
      normalizeFeishuEngineKey: vi.fn(),
      getFeishuRuntimeOwnership: vi.fn(),
      detectLocalOpenClawFeishu: vi.fn(),
      startHermesIMSessionSyncPolling: vi.fn(),
      syncHermesIMSessionsToCowork: vi.fn(),
    };

    const deps = createMainIpcRuntimeImBuilderDeps({ runtime } as never);

    expect(deps.getStore).toBe(runtime.getStore);
    expect(deps.getCoworkStore).toBe(runtime.getCoworkStore);
    expect(deps.getIMGatewayManager).toBe(runtime.getIMGatewayManager);
    expect(deps.getOpenClawEngineManager).toBe(runtime.getOpenClawEngineManager);
    expect(deps.getHermesEngineManager).toBe(runtime.getHermesEngineManager);
    expect(deps.getOpenClawConfigSync).toBe(runtime.getOpenClawConfigSync);
    expect(deps.getHermesConfigSync).toBe(runtime.getHermesConfigSync);
    expect(deps.openClawRuntimeAdapter).toBe(openClawRuntimeAdapter);
    expect(runtime.peekOpenClawRuntimeAdapter).toHaveBeenCalledTimes(1);
    expect(deps.syncOpenClawConfig).toBe(runtime.syncOpenClawConfig);
    expect(deps.resolveFeishuIMAgentEngine).toBe(
      runtime.resolveFeishuIMAgentEngine,
    );
    expect(deps.isFeishuEngineManagedByAgora).toBe(
      runtime.isFeishuEngineManagedByAgora,
    );
    expect(deps.normalizeFeishuEngineKey).toBe(runtime.normalizeFeishuEngineKey);
    expect(deps.getFeishuRuntimeOwnership).toBe(
      runtime.getFeishuRuntimeOwnership,
    );
    expect(deps.getFeishuRuntimeOwnershipStatus).toBe(
      getFeishuRuntimeOwnershipStatus,
    );
    expect(deps.transferFeishuToLocalRuntime).toBe(transferFeishuToLocalRuntime);
    expect(deps.transferFeishuToAgoraRuntime).toBe(transferFeishuToAgoraRuntime);
    expect(deps.detectLocalOpenClawFeishu).toBe(runtime.detectLocalOpenClawFeishu);
    expect(deps.importOpenClawLocalFeishuConfig).toBe(
      importOpenClawLocalFeishuConfig,
    );
    expect(deps.listPairingRequests).toBe(listPairingRequests);
    expect(deps.readAllowFromStore).toBe(readAllowFromStore);
    expect(deps.approvePairingCode).toBe(approvePairingCode);
    expect(deps.rejectPairingRequest).toBe(rejectPairingRequest);
    expect(deps.startHermesIMSessionSyncPolling).toBe(
      runtime.startHermesIMSessionSyncPolling,
    );
    expect(deps.syncHermesIMSessionsToCowork).toBe(
      runtime.syncHermesIMSessionsToCowork,
    );
  });
});
