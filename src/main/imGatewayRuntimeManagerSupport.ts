import { isOpenClawCoworkAgentEngine } from '../shared/cowork/constants';
import { FeishuEngineKey } from '../shared/im/constants';
import type { IMGatewayManagerOptions } from './im';
import { IMGatewayManager } from './im';
import type { IMMessage } from './im/types';
import { buildLLMConfigFromStore } from './imGatewayRuntimeConfigSupport';
import type {
  IMGatewayFeishuSupport,
  IMGatewayRuntimeDeps,
} from './imGatewayRuntimeContract';

type IMGatewayManagerBuilderSupport = Pick<
  IMGatewayFeishuSupport,
  | 'ensureCoworkReady'
  | 'resolveFeishuIMAgentEngine'
  | 'resolveFeishuEngineKey'
  | 'getFeishuManagementMode'
  | 'getFeishuRuntimeOwnership'
>;

export interface CreateIMGatewayManagerOptions {
  deps: IMGatewayRuntimeDeps;
  support: IMGatewayManagerBuilderSupport;
  createScheduledTask: NonNullable<IMGatewayManagerOptions['createScheduledTask']>;
}

export function createIMGatewayManager(
  options: CreateIMGatewayManagerOptions,
): IMGatewayManager {
  const { deps, support, createScheduledTask } = options;
  const sqliteStore = deps.getStore();
  const runtime = deps.getCoworkEngineRouter();
  const coworkStore = deps.getCoworkStore();
  const manager = new IMGatewayManager(sqliteStore.getDatabase(), {
    coworkRuntime: runtime,
    coworkStore,
    ensureCoworkReady: support.ensureCoworkReady,
    isOpenClawEngine: () => (
      isOpenClawCoworkAgentEngine(deps.resolveCoworkAgentEngine())
    ),
    getFeishuAgentEngine: support.resolveFeishuIMAgentEngine,
    getFeishuManagementMode: support.getFeishuManagementMode,
    getFeishuRuntimeOwnership: support.getFeishuRuntimeOwnership,
    getFeishuRuntimeOwnershipStatus: deps.getFeishuRuntimeOwnershipStatus,
    detectOpenClawLocalFeishu: deps.detectLocalOpenClawFeishu,
    syncOpenClawConfig: async () => {
      await deps.syncOpenClawConfig({
        reason: 'im-gateway-start',
      });
    },
    syncHermesConfig: async () => {
      const syncResult = deps.getHermesConfigSync().sync(
        'im-gateway-start',
      );
      if (!syncResult.success) {
        throw new Error(
          syncResult.error || 'Hermes Agent config sync failed.',
        );
      }
    },
    ensureOpenClawGatewayConnected: async () => {
      const runtimeAdapter = deps.peekOpenClawRuntimeAdapter();
      if (runtimeAdapter) {
        await runtimeAdapter.connectGatewayIfNeeded();
      }
    },
    hasLocalOpenClawFeishuEnabled: deps.hasLocalOpenClawFeishuConfigured,
    ensureHermesGatewayReady: async () => {
      const status = await deps.ensureHermesRunningForCowork();
      if (status.phase !== 'running') {
        throw new Error(
          status.message || 'Hermes Agent gateway is not running.',
        );
      }
      deps.startHermesIMSessionSyncPolling();
      void deps.syncHermesIMSessionsToCowork('gateway-ready');
    },
    getOpenClawGatewayClient: () => (
      deps.peekOpenClawRuntimeAdapter()?.getGatewayClient() ?? null
    ),
    ensureOpenClawGatewayReady: async () => {
      const runtimeAdapter = deps.peekOpenClawRuntimeAdapter();
      if (!runtimeAdapter) {
        throw new Error('OpenClaw runtime adapter not initialized.');
      }
      await runtimeAdapter.ensureReady();
      await runtimeAdapter.connectGatewayIfNeeded();
    },
    getOpenClawSessionKeysForCoworkSession: (sessionId: string) => (
      deps.peekOpenClawRuntimeAdapter()?.getSessionKeysForSession(
        sessionId,
      ) ?? []
    ),
    runTeamSession: async ({
      teamId,
      parentSessionId,
      prompt,
      runtimeSource,
    }) => {
      await deps.getAgentTeamRunner().run({
        teamId,
        parentSessionId,
        prompt,
        runtimeSource,
      });
    },
    createScheduledTask,
  });

  manager.initialize({
    getLLMConfig: async () => buildLLMConfigFromStore(sqliteStore),
    getSkillsPrompt: async () => (
      deps.getSkillManager().buildAutoRoutingPrompt()
    ),
  });

  bindIMGatewayManagerEvents(manager, deps.getWindows);
  migrateLegacyFeishuInstances(manager, deps, support.resolveFeishuEngineKey);

  return manager;
}

function bindIMGatewayManagerEvents(
  manager: IMGatewayManager,
  getWindows: IMGatewayRuntimeDeps['getWindows'],
): void {
  manager.on('statusChange', (status) => {
    getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      win.webContents.send('im:status:change', status);
    });
  });

  manager.on('message', (message: IMMessage) => {
    getWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      win.webContents.send('im:message:received', message);
    });
  });

  manager.on('error', ({ platform, error }) => {
    console.error(`[IM Gateway] ${platform} error:`, error);
  });
}

function migrateLegacyFeishuInstances(
  manager: IMGatewayManager,
  deps: IMGatewayRuntimeDeps,
  resolveFeishuEngineKey: IMGatewayFeishuSupport['resolveFeishuEngineKey'],
): void {
  const feishuMigrationEngineKey = deps.hasLocalOpenClawFeishuConfigured()
    ? FeishuEngineKey.OpenClaw
    : resolveFeishuEngineKey();
  manager
    .getIMStore()
    .migrateLegacyFeishuInstances(feishuMigrationEngineKey);
}
