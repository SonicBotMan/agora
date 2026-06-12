import { describe, expect, it, vi } from 'vitest';

vi.mock('./libs/endpoints', () => ({
  getServerApiBaseUrl: vi.fn(),
  refreshEndpointsTestMode: vi.fn(),
}));

vi.mock('./libs/claudeSettings', () => ({
  clearServerModelMetadata: vi.fn(),
  updateServerModelMetadata: vi.fn(),
}));

vi.mock('./i18n', () => ({
  t: vi.fn(),
}));

import { t } from './i18n';
import {
  clearServerModelMetadata,
  updateServerModelMetadata,
} from './libs/claudeSettings';
import {
  getServerApiBaseUrl,
  refreshEndpointsTestMode,
} from './libs/endpoints';
import { createMainIpcCoreBuilderDeps } from './mainBootstrapIpcCoreSupport';

describe('mainBootstrapIpcCoreSupport', () => {
  it('builds IPC core deps and reconnects IM gateways on network restore', async () => {
    const reconnectAllDisconnected = vi.fn();
    const syncOpenClawConfig = vi.fn().mockResolvedValue({ success: true });
    const runtime = {
      peekIMGatewayManager: vi.fn().mockReturnValue({
        reconnectAllDisconnected,
      }),
      getStore: vi.fn().mockReturnValue({ id: 'store' }),
      syncOpenClawConfig,
      getSkillManager: vi.fn(),
    };

    const deps = createMainIpcCoreBuilderDeps({
      runtime,
      state: {
        getMainWindow: vi.fn(),
      },
      normalizeShellPath: vi.fn(),
    } as never);

    deps.onNetworkOnline();
    await deps.onAppConfigChanged();

    expect(reconnectAllDisconnected).toHaveBeenCalled();
    expect(refreshEndpointsTestMode).toHaveBeenCalledWith(runtime.getStore());
    expect(syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'app-config-change',
      restartGatewayIfRunning: false,
    });
    expect(deps.getServerApiBaseUrl).toBe(getServerApiBaseUrl);
    expect(deps.clearServerModelMetadata).toBe(clearServerModelMetadata);
    expect(deps.updateServerModelMetadata).toBe(updateServerModelMetadata);
    expect(deps.t).toBe(t);
  });
});
