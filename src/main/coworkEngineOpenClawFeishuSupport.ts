import { CoworkAgentEngine as CoworkAgentEngineValue } from '../shared/cowork/constants';
import {
  FeishuEngineKey,
  type FeishuEngineKeyType,
  FeishuRuntimeOwnership,
} from '../shared/im/constants';
import type { OpenClawConfigSupportDeps } from './coworkEngineOpenClawConfigContract';
import {
  detectOpenClawLocalFeishuConfig,
  type OpenClawLocalFeishuDetection,
} from './libs/openclawSystemRuntime';

export interface OpenClawConfigFeishuSupport {
  shouldWriteOpenClawFeishuChannel: () => boolean;
  isFeishuManagedByOpenClawConfig: () => boolean;
  detectLocalOpenClawFeishu: () => OpenClawLocalFeishuDetection;
  hasLocalOpenClawFeishuConfigured: () => boolean;
}

export function createOpenClawConfigFeishuSupport(
  deps: OpenClawConfigSupportDeps,
): OpenClawConfigFeishuSupport {
  const isFeishuEngineManagedByAgora = (engineKey: FeishuEngineKeyType) =>
    deps.getFeishuRuntimeOwnership(engineKey)
    === FeishuRuntimeOwnership.AgoraManaged;

  const shouldWriteOpenClawFeishuChannel = (): boolean =>
    isFeishuEngineManagedByAgora(FeishuEngineKey.OpenClaw);

  const isFeishuManagedByOpenClawConfig = (): boolean =>
    isFeishuEngineManagedByAgora(FeishuEngineKey.OpenClaw)
    && deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.OpenClaw;

  const detectLocalOpenClawFeishu = (): OpenClawLocalFeishuDetection => {
    const detection = detectOpenClawLocalFeishuConfig();
    const localStatus = deps.getOpenClawEngineManager().getLocalChannelStatus();
    return {
      ...detection,
      configured: detection.configured || Boolean(localStatus.feishuConfigured),
      enabled: detection.enabled || Boolean(localStatus.feishuRunning),
    };
  };

  const hasLocalOpenClawFeishuConfigured = (): boolean => {
    const detection = detectLocalOpenClawFeishu();
    return Boolean(detection.configured || detection.enabled);
  };

  return {
    shouldWriteOpenClawFeishuChannel,
    isFeishuManagedByOpenClawConfig,
    detectLocalOpenClawFeishu,
    hasLocalOpenClawFeishuConfigured,
  };
}
