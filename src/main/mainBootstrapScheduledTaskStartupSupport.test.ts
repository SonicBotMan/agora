import { describe, expect, it, vi } from 'vitest';

import { createScheduledTaskStartupDeps } from './mainBootstrapScheduledTaskStartupSupport';

describe('mainBootstrapScheduledTaskStartupSupport', () => {
  it('maps scheduled-task startup getters from the runtime registry', () => {
    const runtime = {
      getScheduledTaskIMGatewayManager: vi.fn(),
      peekOpenClawRuntimeAdapter: vi.fn(),
    };

    const deps = createScheduledTaskStartupDeps({ runtime } as never);

    expect(deps.getIMGatewayManager).toBe(runtime.getScheduledTaskIMGatewayManager);
    expect(deps.getOpenClawRuntimeAdapter).toBe(
      runtime.peekOpenClawRuntimeAdapter,
    );
  });
});
