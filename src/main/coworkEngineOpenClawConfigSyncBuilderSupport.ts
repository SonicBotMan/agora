import { FeishuEngineKey } from '../shared/im/constants';
import type { OpenClawConfigSupportDeps } from './coworkEngineOpenClawConfigContract';
import { OpenClawConfigSync } from './libs/openclawConfigSync';

type OpenClawConfigSyncBuilderSupport = {
  shouldWriteOpenClawFeishuChannel: () => boolean;
  isFeishuManagedByOpenClawConfig: () => boolean;
};

export function createOpenClawConfigSyncGetter(
  deps: OpenClawConfigSupportDeps,
  support: OpenClawConfigSyncBuilderSupport,
): () => OpenClawConfigSync {
  let openClawConfigSync: OpenClawConfigSync | null = null;

  return () => {
    if (!openClawConfigSync) {
      openClawConfigSync = new OpenClawConfigSync({
        engineManager: deps.getOpenClawEngineManager(),
        getCoworkConfig: () => deps.getCoworkStore().getConfig(),
        isEnterprise: () => !!deps.getStore().get('enterprise_config'),
        getSkillsList: () =>
          deps.getSkillManager().listSkills().map((skill) => ({
            id: skill.id,
            enabled: skill.enabled,
          })),
        getPopoConfig: () => null,
        getNeteaseBeeChanConfig: () => null,
        getTelegramOpenClawConfig: () => {
          try {
            return deps.getIMGatewayManager()?.getConfig()?.telegram ?? null;
          } catch {
            return null;
          }
        },
        getDingTalkInstances: () => {
          try {
            return deps.getIMGatewayManager().getIMStore().getDingTalkInstances();
          } catch {
            return [];
          }
        },
        getFeishuInstances: () => {
          try {
            return deps
              .getIMGatewayManager()
              .getIMStore()
              .getFeishuInstances(FeishuEngineKey.OpenClaw);
          } catch {
            return [];
          }
        },
        isFeishuManagedByOpenClaw: support.isFeishuManagedByOpenClawConfig,
        shouldWriteFeishuChannel: support.shouldWriteOpenClawFeishuChannel,
        getQQInstances: () => {
          try {
            return deps.getIMGatewayManager().getIMStore().getQQInstances();
          } catch {
            return [];
          }
        },
        getWecomConfig: () => {
          try {
            return deps.getIMGatewayManager().getConfig().wecom;
          } catch {
            return null;
          }
        },
        getWeixinConfig: () => {
          try {
            return deps.getIMGatewayManager().getConfig().weixin;
          } catch {
            return null;
          }
        },
        getIMSettings: () => {
          try {
            return deps.getIMGatewayManager().getConfig().settings;
          } catch {
            return null;
          }
        },
        getDiscordOpenClawConfig: () => {
          try {
            return deps.getIMGatewayManager()?.getConfig()?.discord ?? null;
          } catch {
            return null;
          }
        },
        getMcpBridgeConfig: () => deps.getMcpBridgeConfig(),
        getAgents: () => deps.getCoworkStore().listAgents(),
      });
    }
    return openClawConfigSync;
  };
}
