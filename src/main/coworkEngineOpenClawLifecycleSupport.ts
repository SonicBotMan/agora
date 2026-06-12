import type {
  OpenClawEngineSupport,
  OpenClawEngineSupportDeps,
} from './coworkEngineOpenClawContract';
import type { OpenClawEngineManager } from './libs/openclawEngineManager';

type OpenClawEngineLifecycleDeps = Pick<
  OpenClawEngineSupportDeps,
  'getCoworkStore' | 'startMcpBridge' | 'getMcpBridgeConfig' | 'ensureDefaultIdentity'
> & {
  getOpenClawEngineManager: () => OpenClawEngineManager;
  bindOpenClawStatusForwarder: () => void;
  syncOpenClawConfig: OpenClawEngineSupport['syncOpenClawConfig'];
};

type OpenClawEngineLifecycleSupport = Pick<
  OpenClawEngineSupport,
  | 'bootstrapOpenClawEngine'
  | 'getPendingTokenRefresh'
  | 'setPendingTokenRefresh'
  | 'ensureOpenClawRunningForCowork'
>;

export function createOpenClawEngineLifecycleSupport(
  deps: OpenClawEngineLifecycleDeps,
): OpenClawEngineLifecycleSupport {
  let openClawBootstrapPromise: Promise<
    Awaited<ReturnType<OpenClawEngineSupport['bootstrapOpenClawEngine']>>
  > | null = null;
  let pendingTokenRefresh: Promise<string | null> | null = null;

  const bootstrapOpenClawEngine = async (
    options: Parameters<OpenClawEngineSupport['bootstrapOpenClawEngine']>[0] = {},
  ) => {
    if (openClawBootstrapPromise) {
      return openClawBootstrapPromise;
    }

    const manager = deps.getOpenClawEngineManager();
    deps.bindOpenClawStatusForwarder();

    const task = async () => {
      const reason = options.reason || 'unknown';
      const startedAt = Date.now();
      const elapsed = () => `${Date.now() - startedAt}ms`;
      try {
        console.log(`[OpenClaw] bootstrap starting (reason=${reason})`);

        const bridgeResult = await deps.startMcpBridge().catch(
          (error: unknown): null => {
            console.error(
              '[OpenClaw] bootstrap: MCP bridge startup failed (non-fatal):',
              error,
            );
            return null;
          },
        );
        console.log(
          `[OpenClaw] bootstrap: MCP bridge setup done (${elapsed()}), result=${bridgeResult ? `${bridgeResult.tools.length} tools` : 'null'}`,
        );
        const bridgeConfig = deps.getMcpBridgeConfig();
        console.log(
          `[OpenClaw] bootstrap: mcpBridgeServer=${bridgeConfig?.callbackUrl || 'null'}, mcpServerManager.tools=${bridgeConfig?.tools.length ?? 'null'}, secret=${bridgeConfig?.secret ? 'set' : 'null'}`,
        );

        try {
          deps.ensureDefaultIdentity(
            deps.getCoworkStore().getConfig().workingDirectory,
          );
        } catch (error) {
          console.warn(
            '[OpenClaw] bootstrap: ensureDefaultIdentity failed (non-fatal):',
            error,
          );
        }

        const syncResult = await deps.syncOpenClawConfig({
          reason: `bootstrap:${reason}`,
          restartGatewayIfRunning: false,
        });
        console.log(
          `[OpenClaw] bootstrap: syncOpenClawConfig done (${elapsed()}), success=${syncResult.success}`,
        );
        if (!syncResult.success) {
          return syncResult.status || manager.getStatus();
        }
        if (options.forceReinstall) {
          await manager.stopGateway();
          console.log(`[OpenClaw] bootstrap: stopGateway done (${elapsed()})`);
        }
        const ensuredStatus = await manager.ensureReady({
          forceReinstall: Boolean(options.forceReinstall),
        });
        console.log(
          `[OpenClaw] bootstrap: ensureReady done (${elapsed()}), phase=${ensuredStatus.phase}`,
        );
        if (
          ensuredStatus.phase !== 'ready'
          && ensuredStatus.phase !== 'running'
        ) {
          return ensuredStatus;
        }
        const result = await manager.startGateway();
        console.log(
          `[OpenClaw] bootstrap completed (${elapsed()}), phase=${result.phase}`,
        );
        return result;
      } catch (error) {
        console.error(
          `[OpenClaw] bootstrap failed (${reason}, ${elapsed()}):`,
          error,
        );
        return manager.getStatus();
      }
    };

    const promise = task().finally(() => {
      if (openClawBootstrapPromise === promise) {
        openClawBootstrapPromise = null;
      }
    });
    openClawBootstrapPromise = promise;
    return promise;
  };

  const ensureOpenClawRunningForCowork = async () => {
    const manager = deps.getOpenClawEngineManager();

    if (pendingTokenRefresh) {
      console.log(
        '[OpenClaw] ensureRunning: awaiting pending token refresh before gateway start',
      );
      await pendingTokenRefresh.catch(() => {});
    }

    await deps.startMcpBridge().catch((error: unknown) => {
      console.error(
        '[OpenClaw] ensureRunning: MCP bridge startup failed (non-fatal):',
        error,
      );
    });
    const syncResult = await deps.syncOpenClawConfig({
      reason: 'ensureRunning:mcpBridge',
      restartGatewayIfRunning: false,
    });
    if (!syncResult.success) {
      console.error(
        '[OpenClaw] ensureRunning: config sync failed:',
        syncResult.error,
      );
    }

    const status = manager.getStatus();
    if (status.phase === 'running' || status.phase === 'starting') {
      return status;
    }

    return await manager.startGateway();
  };

  return {
    bootstrapOpenClawEngine,
    getPendingTokenRefresh: () => pendingTokenRefresh,
    setPendingTokenRefresh: (promise) => {
      pendingTokenRefresh = promise;
    },
    ensureOpenClawRunningForCowork,
  };
}
