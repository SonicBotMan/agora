import type { BrowserWindow } from 'electron';

import type {
  FeishuEngineKeyType,
  FeishuRuntimeOwnershipType,
} from '../shared/im/constants';
import type { IMGatewayManager } from './im';
import type { FeishuIMAgentEngine } from './imGatewayRuntimeSupport';
import type {
  MainRuntimeRegistryCoworkAgentRuntimeSupport,
} from './mainRuntimeRegistryCoworkAgentRuntimeSupport';
import type {
  MainRuntimeRegistryCoworkEngineRuntimeSupport,
} from './mainRuntimeRegistryCoworkEngineRuntimeSupport';
import type {
  MainRuntimeRegistryCoworkRouterRuntimeSupport,
} from './mainRuntimeRegistryCoworkRouterRuntimeSupport';
import type { MainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';

export interface MainRuntimeRegistryCoworkRuntimeSupportDeps {
  getWindows: () => BrowserWindow[];
  getStore: MainRuntimeRegistrySupport['getStore'];
  getMcpBridgeRuntime: MainRuntimeRegistrySupport['getMcpBridgeRuntime'];
  getCoworkStore: MainRuntimeRegistrySupport['getCoworkStore'];
  getCoworkRuntimeForwarder: MainRuntimeRegistrySupport['getCoworkRuntimeForwarder'];
  getExternalAgentProviderStore: MainRuntimeRegistrySupport['getExternalAgentProviderStore'];
  getRuntimeTelemetryTracker: MainRuntimeRegistrySupport['getRuntimeTelemetryTracker'];
  getExternalAgentCliInstaller: MainRuntimeRegistrySupport['getExternalAgentCliInstaller'];
  getDeepSeekTuiRuntimeManager: MainRuntimeRegistrySupport['getDeepSeekTuiRuntimeManager'];
  getSkillManager: MainRuntimeRegistrySupport['getSkillManager'];
  getIMGatewayManager: () => IMGatewayManager;
  getFeishuRuntimeOwnership: (
    engineKey: FeishuEngineKeyType,
  ) => FeishuRuntimeOwnershipType;
  resolveFeishuIMAgentEngine: () => FeishuIMAgentEngine | null;
}

export interface MainRuntimeRegistryCoworkRuntimeSupport
  extends MainRuntimeRegistryCoworkAgentRuntimeSupport,
    MainRuntimeRegistryCoworkEngineRuntimeSupport,
    MainRuntimeRegistryCoworkRouterRuntimeSupport {}
