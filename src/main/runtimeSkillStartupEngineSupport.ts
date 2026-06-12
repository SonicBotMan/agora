import {
  isOpenClawCoworkAgentEngine,
} from '../shared/cowork/constants';
import type {
  RuntimeSkillAppConfig,
  RuntimeSkillStartupBootstrapDeps,
} from './runtimeSkillStartupBootstrapContract';

type EngineSyncDeps = Pick<
  RuntimeSkillStartupBootstrapDeps,
  | 'bindCoworkRuntimeForwarder'
  | 'bindOpenClawStatusForwarder'
  | 'syncOpenClawConfig'
  | 'getHermesConfigSync'
>;

type OpenClawStartupDeps = Pick<
  RuntimeSkillStartupBootstrapDeps,
  | 'resolveCoworkAgentEngine'
  | 'ensureOpenClawRunningForCowork'
  | 'getCronJobService'
>;

type ProxyStartupDeps = Pick<
  RuntimeSkillStartupBootstrapDeps,
  | 'store'
  | 'getUseSystemProxyFromConfig'
  | 'applyProxyPreference'
  | 'resolveCoworkAgentEngine'
  | 'syncOpenClawConfig'
> & {
  startCoworkOpenAICompatProxy: () => Promise<unknown>;
};

export async function bootstrapRuntimeEngineSync(
  deps: EngineSyncDeps,
): Promise<void> {
  deps.bindCoworkRuntimeForwarder();
  deps.bindOpenClawStatusForwarder();

  const startupSync = await deps.syncOpenClawConfig({
    reason: 'startup',
    restartGatewayIfRunning: false,
  });
  if (!startupSync.success) {
    console.error('[OpenClaw] Startup config sync failed:', startupSync.error);
  }

  const hermesStartupSync = deps.getHermesConfigSync().sync('startup');
  if (!hermesStartupSync.success) {
    console.error(
      '[Hermes] Startup config sync failed:',
      hermesStartupSync.error,
    );
  }
}

export function startOpenClawRuntimeIfNeeded(
  deps: OpenClawStartupDeps,
): void {
  if (!isOpenClawCoworkAgentEngine(deps.resolveCoworkAgentEngine())) {
    return;
  }

  void deps.ensureOpenClawRunningForCowork()
    .then(() => {
      try {
        deps.getCronJobService().startPolling();
      } catch (error) {
        console.warn(
          '[Main] CronJobService not available after OpenClaw startup:',
          error,
        );
      }
    })
    .catch((error) => {
      console.error(
        '[OpenClaw] Failed to auto-start gateway on app startup:',
        error,
      );
    });
}

export async function finalizeRuntimeProxyStartup(
  deps: ProxyStartupDeps,
): Promise<void> {
  const appConfig = deps.store.get<RuntimeSkillAppConfig>('app_config');
  await deps.applyProxyPreference(deps.getUseSystemProxyFromConfig(appConfig));

  await deps.startCoworkOpenAICompatProxy().catch((error) => {
    console.error('Failed to start OpenAI compatibility proxy:', error);
  });

  if (!isOpenClawCoworkAgentEngine(deps.resolveCoworkAgentEngine())) {
    return;
  }

  const proxyResync = await deps.syncOpenClawConfig({
    reason: 'proxy-ready',
  });
  if (proxyResync.changed) {
    console.log(
      '[Main] OpenClaw config updated after proxy ready, gateway will restart to pick up new config',
    );
  }
}
