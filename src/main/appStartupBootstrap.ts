import { registerAppPostStartupLifecycle } from './appPostStartupLifecycle';
import type { AppStartupBootstrapDeps } from './appStartupBootstrapContract';
import {
  createAppPostStartupLifecycleDeps,
  createAuthRuntimeBootstrapDeps,
  createRuntimeSkillStartupDeps,
} from './appStartupBootstrapSupport';
import { bootstrapAuthRuntime } from './authRuntimeBootstrap';
import { bootstrapCoreAppStartup } from './coreAppStartupBootstrap';
import { bootstrapEnterpriseStartup } from './enterpriseStartupBootstrap';
import { configureContentSecurityPolicy } from './mainWindowSecurity';
import { bootstrapRuntimeSkillStartup } from './runtimeSkillStartupBootstrap';
export type { AppStartupBootstrapDeps } from './appStartupBootstrapContract';

export async function bootstrapAppStartup(
  deps: AppStartupBootstrapDeps,
): Promise<void> {
  console.log('[Main] initApp: waiting for app.whenReady()');
  await deps.app.whenReady();
  console.log('[Main] initApp: app is ready');

  // Note: Calendar permission is checked on-demand when calendar operations are requested
  // We don't trigger permission dialogs at startup to avoid annoying users

  const store = await bootstrapCoreAppStartup({
    initStore: deps.initStore,
    getCoworkStore: deps.getCoworkStore,
    getRuntimeTelemetryStore: deps.getRuntimeTelemetryStore,
  });
  deps.setStore(store);

  await bootstrapAuthRuntime(createAuthRuntimeBootstrapDeps(deps));

  bootstrapEnterpriseStartup({
    store,
    getCoworkStore: deps.getCoworkStore,
    getIMGatewayManager: deps.getIMGatewayManager,
    getMcpStore: deps.getMcpStore,
  });

  await bootstrapRuntimeSkillStartup(createRuntimeSkillStartupDeps(deps));

  configureContentSecurityPolicy(deps.isDev);

  console.log('[Main] initApp: creating window');
  deps.createWindow();
  console.log('[Main] initApp: window created');

  registerAppPostStartupLifecycle(createAppPostStartupLifecycleDeps(deps));
}
