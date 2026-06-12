import { startCoworkOpenAICompatProxy } from './libs/coworkOpenAICompatProxy';
import type { RuntimeSkillStartupBootstrapDeps } from './runtimeSkillStartupBootstrapContract';
import {
  bootstrapRuntimeEngineSync,
  finalizeRuntimeProxyStartup,
  startOpenClawRuntimeIfNeeded,
} from './runtimeSkillStartupEngineSupport';
import {
  initializeRuntimeSkillManager,
  initializeRuntimeSkillServices,
} from './runtimeSkillStartupSkillSupport';

export type { RuntimeSkillStartupBootstrapDeps } from './runtimeSkillStartupBootstrapContract';

export async function bootstrapRuntimeSkillStartup(
  deps: RuntimeSkillStartupBootstrapDeps,
): Promise<void> {
  await bootstrapRuntimeEngineSync(deps);
  startOpenClawRuntimeIfNeeded(deps);
  initializeRuntimeSkillManager(deps);
  await initializeRuntimeSkillServices();
  await finalizeRuntimeProxyStartup({
    ...deps,
    startCoworkOpenAICompatProxy,
  });
}
