import { CoworkAgentEngine as CoworkAgentEngineValue } from '../../shared/cowork/constants';
import { FeishuEngineKey } from '../../shared/im/constants';
import type { ImDeps } from './imDeps';

let imConfigSyncTimer: ReturnType<typeof setTimeout> | null = null;
let imConfigSyncRunning = false;
let imConfigSyncPending = false;
const IM_CONFIG_SYNC_DEBOUNCE_MS = 600;

export type ImConfigSyncDeps = Pick<
  ImDeps,
  | 'getIMGatewayManager'
  | 'getOpenClawEngineManager'
  | 'getHermesEngineManager'
  | 'getHermesConfigSync'
  | 'openClawRuntimeAdapter'
  | 'syncOpenClawConfig'
  | 'resolveFeishuIMAgentEngine'
  | 'isFeishuEngineManagedByAgora'
  | 'startHermesIMSessionSyncPolling'
  | 'syncHermesIMSessionsToCowork'
>;

function hasEnabledOpenClawManagedIMPlatform(deps: ImConfigSyncDeps): boolean {
  const config = deps.getIMGatewayManager().getConfig();
  const feishuManagedByOpenClaw = deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.OpenClaw;
  const feishuManagedByAgora = deps.isFeishuEngineManagedByAgora(FeishuEngineKey.OpenClaw);
  const localOpenClawFeishuEnabled = feishuManagedByOpenClaw
    && !feishuManagedByAgora
    && Boolean(deps.getOpenClawEngineManager().getLocalChannelStatus().feishuConfigured);

  return Boolean(
    (config as any).dingtalk?.instances?.some((i: any) => i.enabled && i.clientId && i.clientSecret)
    || localOpenClawFeishuEnabled
    || (feishuManagedByOpenClaw && feishuManagedByAgora && (config as any).feishu?.instances?.some((i: any) => i.enabled && i.appId && i.appSecret))
    || ((config as any).telegram?.enabled && (config as any).telegram.botToken)
    || ((config as any).discord?.enabled && (config as any).discord.botToken)
    || (config as any).qq?.instances?.some((i: any) => i.enabled && i.appId && i.appSecret)
    || ((config as any).wecom?.enabled && (config as any).wecom.botId && (config as any).wecom.secret)
    || (config as any).weixin?.enabled
    || ((config as any).popo?.enabled && (config as any).popo.appKey && (config as any).popo.appSecret && (config as any).popo.aesKey)
    || ((config as any).nim?.enabled && (config as any).nim.appKey && (config as any).nim.account && (config as any).nim.token)
    || ((config as any)['netease-bee']?.enabled && (config as any)['netease-bee'].clientId && (config as any)['netease-bee'].secret)
  );
}

async function doImConfigSync(deps: ImConfigSyncDeps): Promise<void> {
  imConfigSyncRunning = true;
  try {
    await deps.syncOpenClawConfig({
      reason: 'im-config-change',
      restartGatewayIfRunning: true,
    });

    if (deps.openClawRuntimeAdapter && hasEnabledOpenClawManagedIMPlatform(deps)) {
      try {
        await deps.openClawRuntimeAdapter.connectGatewayIfNeeded();
      } catch (connectError) {
        console.error('[IM] Failed to connect gateway client after config sync:', connectError);
      }
    }

    if (deps.isFeishuEngineManagedByAgora(FeishuEngineKey.Hermes)) {
      const hermesSyncResult = deps.getHermesConfigSync().sync('im-config-change');
      if (!hermesSyncResult.success) {
        throw new Error(hermesSyncResult.error || 'Hermes Agent config sync failed.');
      }
      const hermesStatus = deps.getHermesEngineManager().getStatus();
      if (hermesSyncResult.changed && hermesStatus.phase === 'running') {
        const restarted = await deps.getHermesEngineManager().restartGateway();
        if (restarted.phase !== 'running') {
          throw new Error(restarted.message || 'Hermes Agent gateway failed to restart after IM config sync.');
        }
      }
    }

    const feishuAgentEngine = deps.resolveFeishuIMAgentEngine();
    if (feishuAgentEngine === CoworkAgentEngineValue.Hermes) {
      deps.startHermesIMSessionSyncPolling();
      void deps.syncHermesIMSessionsToCowork('im-config-change');
    } else if (
      feishuAgentEngine === CoworkAgentEngineValue.ClaudeCode
      || feishuAgentEngine === CoworkAgentEngineValue.Codex
    ) {
      await deps.getIMGatewayManager().startAllEnabled();
    }
  } catch (error) {
    console.error('[IM] Debounced config sync failed:', error);
  } finally {
    imConfigSyncRunning = false;
    if (imConfigSyncPending) {
      imConfigSyncPending = false;
      scheduleImConfigSync(deps);
    }
  }
}

export function scheduleImConfigSync(deps: ImConfigSyncDeps): void {
  if (imConfigSyncRunning) {
    imConfigSyncPending = true;
    return;
  }
  if (imConfigSyncTimer) clearTimeout(imConfigSyncTimer);
  imConfigSyncTimer = setTimeout(() => {
    imConfigSyncTimer = null;
    void doImConfigSync(deps);
  }, IM_CONFIG_SYNC_DEBOUNCE_MS);
}

export function shouldSyncRunningIMGatewayConfig(deps: Pick<
  ImDeps,
  | 'getOpenClawEngineManager'
  | 'getHermesEngineManager'
  | 'resolveFeishuIMAgentEngine'
>): boolean {
  return (
    deps.getOpenClawEngineManager().getStatus().phase === 'running'
    || deps.getHermesEngineManager().getStatus().phase === 'running'
    || deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.Hermes
    || deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.ClaudeCode
    || deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.Codex
  );
}
