export interface AppShutdownCleanupDeps {
  destroyTray: () => void;
  stopHermesIMSessionSyncPolling: () => void;
  stopSkillWatcher: () => void;
  stopCoworkSessions: () => void;
  stopCoworkFileActivity: () => void;
  stopCoworkOpenAICompatProxy: () => Promise<void>;
  stopOpenClawTokenProxy: () => void;
  stopSkillServices: () => Promise<void>;
  stopIMGateways: () => Promise<void>;
  stopOpenClawGateway: () => Promise<void>;
  stopMcpBridge: () => Promise<void>;
  stopCronPolling: () => void;
  closeStore: () => void;
}

export async function runAppShutdownCleanup(
  deps: AppShutdownCleanupDeps,
): Promise<void> {
  console.log('[Main] App is quitting, starting cleanup...');
  deps.destroyTray();
  deps.stopHermesIMSessionSyncPolling();
  deps.stopSkillWatcher();
  deps.stopCoworkSessions();
  deps.stopCoworkFileActivity();

  await deps.stopCoworkOpenAICompatProxy().catch((error) => {
    console.error('Failed to stop OpenAI compatibility proxy:', error);
  });

  deps.stopOpenClawTokenProxy();
  await deps.stopSkillServices();

  await deps.stopIMGateways().catch((error) => {
    console.error('[IM Gateway] Error stopping gateways on quit:', error);
  });

  await deps.stopOpenClawGateway().catch((error) => {
    console.error('[OpenClaw] Failed to stop gateway on quit:', error);
  });

  await deps.stopMcpBridge().catch((error) => {
    console.error('[McpBridge] Failed to stop bridge on quit:', error);
  });

  try {
    deps.stopCronPolling();
  } catch {
    // CronJobService may not have been initialized — safe to ignore.
  }

  try {
    deps.closeStore();
  } catch {
    // Store may not have been initialized — safe to ignore.
  }
}
