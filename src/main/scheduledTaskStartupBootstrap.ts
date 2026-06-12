import type {
  CronJobServiceDeps,
  ScheduledTaskHandlerDeps,
  ScheduledTaskHelperDeps,
} from './ipcHandlers/scheduledTask';
import {
  getCronJobService,
  initCronJobServiceManager,
  initScheduledTaskHelpers,
  registerScheduledTaskHandlers,
} from './ipcHandlers/scheduledTask';

export interface ScheduledTaskStartupBootstrapDeps {
  getIMGatewayManager: () => (
    NonNullable<ReturnType<ScheduledTaskHelperDeps['getIMGatewayManager']>>
    & NonNullable<ReturnType<ScheduledTaskHandlerDeps['getIMGatewayManager']>>
  ) | null;
  getOpenClawRuntimeAdapter: () => (
    NonNullable<ReturnType<CronJobServiceDeps['getOpenClawRuntimeAdapter']>>
    & NonNullable<ReturnType<ScheduledTaskHandlerDeps['getOpenClawRuntimeAdapter']>>
  ) | null;
}

export function bootstrapScheduledTaskStartup(
  deps: ScheduledTaskStartupBootstrapDeps,
): void {
  const { getIMGatewayManager, getOpenClawRuntimeAdapter } = deps;

  initCronJobServiceManager({
    getOpenClawRuntimeAdapter,
  });

  initScheduledTaskHelpers({
    getIMGatewayManager,
  });

  registerScheduledTaskHandlers({
    getCronJobService,
    getIMGatewayManager,
    getOpenClawRuntimeAdapter,
  } satisfies ScheduledTaskHandlerDeps);
}
