import type { Session } from 'electron';

import {
  applySystemProxyEnv,
  resolveSystemProxyUrl,
  restoreOriginalProxyEnv,
  setSystemProxyEnabled,
} from './libs/systemProxy';

export function getUseSystemProxyFromConfig(
  config?: { useSystemProxy?: boolean },
): boolean {
  return config?.useSystemProxy === true;
}

export async function applyMainWindowProxyPreference(
  defaultSession: Pick<Session, 'setProxy'>,
  useSystemProxy: boolean,
): Promise<void> {
  try {
    await defaultSession.setProxy({
      mode: useSystemProxy ? 'system' : 'direct',
    });
  } catch (error) {
    console.error('[Main] Failed to apply session proxy mode:', error);
  }

  setSystemProxyEnabled(useSystemProxy);

  if (!useSystemProxy) {
    restoreOriginalProxyEnv();
    console.log('[Main] System proxy disabled (direct mode).');
    return;
  }

  const proxyUrl = await resolveSystemProxyUrl('https://openrouter.ai');
  applySystemProxyEnv(proxyUrl);

  if (proxyUrl) {
    console.log('[Main] System proxy enabled for process env:', proxyUrl);
  } else {
    console.warn(
      '[Main] System proxy mode enabled, but no proxy endpoint was resolved (DIRECT).',
    );
  }
}
