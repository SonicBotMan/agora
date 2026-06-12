import type { BrowserWindow } from 'electron';

import type {
  FeishuEngineKeyType,
  FeishuRuntimeOwnershipType,
} from '../shared/im/constants';
import type { CoworkEngineRuntime } from './coworkEngineRuntime';
import type { IMGatewayManager } from './im';
import type { FeishuIMAgentEngine } from './imGatewayRuntimeSupport';
import type { OpenClawRuntimeAdapter } from './libs/agentEngine';
import type { MainRuntimeRegistrySupport } from './mainRuntimeRegistrySupport';

export interface MainRuntimeRegistryCoworkEngineRuntimeSupportDeps {
  getWindows: () => BrowserWindow[];
  getStore: MainRuntimeRegistrySupport['getStore'];
  getMcpBridgeRuntime: MainRuntimeRegistrySupport['getMcpBridgeRuntime'];
  getCoworkStore: MainRuntimeRegistrySupport['getCoworkStore'];
  getCoworkRuntimeForwarder: MainRuntimeRegistrySupport['getCoworkRuntimeForwarder'];
  getSkillManager: MainRuntimeRegistrySupport['getSkillManager'];
  getIMGatewayManager: () => IMGatewayManager;
  getFeishuRuntimeOwnership: (
    engineKey: FeishuEngineKeyType,
  ) => FeishuRuntimeOwnershipType;
  resolveFeishuIMAgentEngine: () => FeishuIMAgentEngine | null;
  peekOpenClawRuntimeAdapter: () => OpenClawRuntimeAdapter | null;
}

export interface MainRuntimeRegistryCoworkEngineRuntimeSupport {
  peekOpenClawEngineManager: CoworkEngineRuntime['peekOpenClawEngineManager'];
  peekHermesEngineManager: CoworkEngineRuntime['peekHermesEngineManager'];
  getPendingTokenRefresh: CoworkEngineRuntime['getPendingTokenRefresh'];
  setPendingTokenRefresh: CoworkEngineRuntime['setPendingTokenRefresh'];
  getOpenClawEngineManager: CoworkEngineRuntime['getOpenClawEngineManager'];
  getHermesEngineManager: CoworkEngineRuntime['getHermesEngineManager'];
  bindOpenClawStatusForwarder: CoworkEngineRuntime['bindOpenClawStatusForwarder'];
  bindHermesStatusForwarder: CoworkEngineRuntime['bindHermesStatusForwarder'];
  getHermesConfigSync: CoworkEngineRuntime['getHermesConfigSync'];
  bootstrapHermesEngine: CoworkEngineRuntime['bootstrapHermesEngine'];
  ensureOpenClawRunningForCowork: CoworkEngineRuntime['ensureOpenClawRunningForCowork'];
  ensureHermesRunningForCowork: CoworkEngineRuntime['ensureHermesRunningForCowork'];
  detectLocalOpenClawFeishu: CoworkEngineRuntime['detectLocalOpenClawFeishu'];
  hasLocalOpenClawFeishuConfigured: CoworkEngineRuntime['hasLocalOpenClawFeishuConfigured'];
  syncHermesIMSessionsToCowork: CoworkEngineRuntime['syncHermesIMSessionsToCowork'];
  startHermesIMSessionSyncPolling: CoworkEngineRuntime['startHermesIMSessionSyncPolling'];
  stopHermesIMSessionSyncPolling: CoworkEngineRuntime['stopHermesIMSessionSyncPolling'];
  getOpenClawConfigSync: CoworkEngineRuntime['getOpenClawConfigSync'];
  syncOpenClawConfig: CoworkEngineRuntime['syncOpenClawConfig'];
}
