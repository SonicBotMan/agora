/**
 * Agora — App IPC Handlers
 * Application-level settings: auto-launch, prevent-sleep, version info,
 * system locale, and enterprise configuration.
 *
 * Extracted from main.ts lines 2685–2843.
 */

import { ipcMain, app, powerSaveBlocker } from 'electron';

import { getAutoLaunchEnabled, setAutoLaunchEnabled } from '../autoLaunchManager';

/**
 * Interface to read/write the SQLite KV store.
 */
export interface StoreOps {
  get<T = unknown>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
}

export interface AppDeps {
  getStore: () => StoreOps;
}

export function registerAppHandlers(deps: AppDeps): void {
  // Prevent-sleep blocker ID tracked at module scope (mirrors main.ts pattern)
  let preventSleepBlockerId: number | null = null;

  // enterprise:getConfig
  ipcMain.handle('enterprise:getConfig', async () => {
    try {
      return (deps.getStore().get('enterprise_config') as unknown) ?? null;
    } catch {
      return null;
    }
  });

  // app:getAutoLaunch
  // Uses SQLite store as the source of truth for UI state, because
  // app.getLoginItemSettings() returns unreliable values on macOS and
  // requires matching args on Windows.
  ipcMain.handle('app:getAutoLaunch', () => {
    const stored = deps.getStore().get<boolean>('auto_launch_enabled');
    // Fall back to OS API if SQLite has no record yet (e.g. upgraded from older version)
    const enabled = stored ?? getAutoLaunchEnabled();
    return { enabled };
  });

  // app:setAutoLaunch
  ipcMain.handle('app:setAutoLaunch', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      return { success: false, error: 'Invalid parameter: enabled must be boolean' };
    }
    try {
      setAutoLaunchEnabled(enabled);
      deps.getStore().set('auto_launch_enabled', enabled);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set auto-launch',
      };
    }
  });

  // app:getPreventSleep
  ipcMain.handle('app:getPreventSleep', () => {
    const enabled = deps.getStore().get<boolean>('prevent_sleep_enabled') ?? false;
    return { enabled };
  });

  // app:setPreventSleep
  ipcMain.handle('app:setPreventSleep', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      return { success: false, error: 'Invalid parameter: enabled must be boolean' };
    }
    try {
      if (enabled) {
        if (preventSleepBlockerId === null || !powerSaveBlocker.isStarted(preventSleepBlockerId)) {
          preventSleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
        }
      } else {
        if (preventSleepBlockerId !== null && powerSaveBlocker.isStarted(preventSleepBlockerId)) {
          powerSaveBlocker.stop(preventSleepBlockerId);
          preventSleepBlockerId = null;
        }
      }
      deps.getStore().set('prevent_sleep_enabled', enabled);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set prevent-sleep',
      };
    }
  });

  // app:getVersion
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // app:getSystemLocale
  ipcMain.handle('app:getSystemLocale', () => app.getLocale());
}
