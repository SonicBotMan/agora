import { ensurePythonRuntimeReady } from './libs/pythonRuntime';
import type {
  RuntimeSkillStartupBootstrapDeps,
  SkillManagerLike,
} from './runtimeSkillStartupBootstrapContract';
import { getSkillServiceManager } from './skillServices';

type SkillRuntimeDeps = Pick<
  RuntimeSkillStartupBootstrapDeps,
  'getSkillManager' | 'syncOpenClawConfig'
>;

export function initializeRuntimeSkillManager(
  deps: SkillRuntimeDeps,
): SkillManagerLike {
  console.log('[Main] initApp: setStoreGetter done');
  const manager = deps.getSkillManager();
  console.log('[Main] initApp: getSkillManager done');

  manager.onSkillsChanged(() => {
    deps.syncOpenClawConfig({ reason: 'skills-changed' }).catch((error) => {
      console.warn(
        '[Main] Failed to sync OpenClaw config after skills change:',
        error,
      );
    });
  });

  try {
    manager.syncBundledSkillsToUserData();
    console.log('[Main] initApp: syncBundledSkillsToUserData done');
  } catch (error) {
    console.error('[Main] initApp: syncBundledSkillsToUserData failed:', error);
  }

  try {
    manager.recoverInterruptedUpgrades();
    console.log('[Main] initApp: recoverInterruptedUpgrades done');
  } catch (error) {
    console.error(
      '[Main] initApp: recoverInterruptedUpgrades failed:',
      error,
    );
  }

  try {
    manager.startWatching();
    console.log('[Main] initApp: startWatching done');
  } catch (error) {
    console.error('[Main] initApp: startWatching failed:', error);
  }

  return manager;
}

export async function initializeRuntimeSkillServices(): Promise<void> {
  try {
    const runtimeResult = await ensurePythonRuntimeReady();
    if (!runtimeResult.success) {
      console.error(
        '[Main] initApp: ensurePythonRuntimeReady failed:',
        runtimeResult.error,
      );
    } else {
      console.log('[Main] initApp: ensurePythonRuntimeReady done');
    }
  } catch (error) {
    console.error('[Main] initApp: ensurePythonRuntimeReady threw:', error);
  }

  try {
    const skillServices = getSkillServiceManager();
    console.log('[Main] initApp: getSkillServiceManager done');
    await skillServices.startAll();
    console.log('[Main] initApp: skill services started');
  } catch (error) {
    console.error('[Main] initApp: skill services failed:', error);
  }
}
