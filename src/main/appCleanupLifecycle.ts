import { app } from 'electron';

export interface AppCleanupLifecycleDeps {
  markQuitting: () => void;
  runCleanup: () => Promise<void>;
}

export function registerAppCleanupLifecycle(
  deps: AppCleanupLifecycleDeps,
): void {
  let isCleanupFinished = false;
  let isCleanupInProgress = false;

  const finalizeExit = (): void => {
    isCleanupFinished = true;
    isCleanupInProgress = false;
    app.exit(0);
  };

  const startCleanup = (logLabel: string): void => {
    if (isCleanupFinished || isCleanupInProgress) {
      return;
    }

    isCleanupInProgress = true;
    deps.markQuitting();
    void deps
      .runCleanup()
      .catch((error) => {
        console.error(logLabel, error);
      })
      .finally(finalizeExit);
  };

  app.on('before-quit', (event) => {
    if (isCleanupFinished) return;

    event.preventDefault();
    if (isCleanupInProgress) {
      return;
    }

    startCleanup('[Main] Cleanup error:');
  });

  const handleTerminationSignal = (signal: NodeJS.Signals) => {
    if (isCleanupFinished || isCleanupInProgress) {
      return;
    }
    console.log(`[Main] Received ${signal}, running cleanup before exit...`);
    startCleanup(`[Main] Cleanup error during ${signal}:`);
  };

  process.once('SIGINT', () => handleTerminationSignal('SIGINT'));
  process.once('SIGTERM', () => handleTerminationSignal('SIGTERM'));
}
