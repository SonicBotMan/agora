import { beforeEach, describe, expect, it, vi } from 'vitest';

const scheduledTaskStartupBootstrapTestState = vi.hoisted(() => {
  const getCronJobService = vi.fn();
  const initCronJobServiceManager = vi.fn();
  const initScheduledTaskHelpers = vi.fn();
  const registerScheduledTaskHandlers = vi.fn();

  return {
    getCronJobService,
    initCronJobServiceManager,
    initScheduledTaskHelpers,
    registerScheduledTaskHandlers,
  };
});

vi.mock('./ipcHandlers/scheduledTask', () => ({
  getCronJobService:
    scheduledTaskStartupBootstrapTestState.getCronJobService,
  initCronJobServiceManager:
    scheduledTaskStartupBootstrapTestState.initCronJobServiceManager,
  initScheduledTaskHelpers:
    scheduledTaskStartupBootstrapTestState.initScheduledTaskHelpers,
  registerScheduledTaskHandlers:
    scheduledTaskStartupBootstrapTestState.registerScheduledTaskHandlers,
}));

import { bootstrapScheduledTaskStartup } from './scheduledTaskStartupBootstrap';

describe('scheduledTaskStartupBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes cron manager, helper deps, and scheduled task handlers with shared runtime accessors', () => {
    const deps = {
      getIMGatewayManager: vi.fn(),
      getOpenClawRuntimeAdapter: vi.fn(),
    };

    bootstrapScheduledTaskStartup(deps as never);

    expect(
      scheduledTaskStartupBootstrapTestState.initCronJobServiceManager,
    ).toHaveBeenCalledWith({
      getOpenClawRuntimeAdapter: deps.getOpenClawRuntimeAdapter,
    });
    expect(
      scheduledTaskStartupBootstrapTestState.initScheduledTaskHelpers,
    ).toHaveBeenCalledWith({
      getIMGatewayManager: deps.getIMGatewayManager,
    });
    expect(
      scheduledTaskStartupBootstrapTestState.registerScheduledTaskHandlers,
    ).toHaveBeenCalledWith({
      getCronJobService:
        scheduledTaskStartupBootstrapTestState.getCronJobService,
      getIMGatewayManager: deps.getIMGatewayManager,
      getOpenClawRuntimeAdapter: deps.getOpenClawRuntimeAdapter,
    });
  });
});
