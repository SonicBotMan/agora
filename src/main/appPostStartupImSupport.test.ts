import { describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../shared/cowork/constants';
import { startEnabledIMGateways } from './appPostStartupImSupport';

describe('appPostStartupImSupport', () => {
  it('starts gateways and hermes sync when feishu engine is hermes', async () => {
    const startAllEnabled = vi.fn().mockResolvedValue(undefined);
    const startHermesIMSessionSyncPolling = vi.fn();
    const syncHermesIMSessionsToCowork = vi.fn().mockResolvedValue(undefined);

    startEnabledIMGateways({
      getIMGatewayManager: () => ({ startAllEnabled }),
      resolveFeishuIMAgentEngine: () => CoworkAgentEngine.Hermes,
      hermesEngineValue: CoworkAgentEngine.Hermes,
      startHermesIMSessionSyncPolling,
      syncHermesIMSessionsToCowork,
    });

    await Promise.resolve();

    expect(startAllEnabled).toHaveBeenCalled();
    expect(startHermesIMSessionSyncPolling).toHaveBeenCalled();
    expect(syncHermesIMSessionsToCowork).toHaveBeenCalledWith('startup');
  });
});
