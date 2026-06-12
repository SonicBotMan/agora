import type { Platform } from '../im/types';

export interface ImDeps {
  getStore: () => {
    get: <T = unknown>(key: string) => T | undefined;
    set: <T = unknown>(key: string, value: T) => void;
    delete: (key: string) => void;
  };

  getCoworkStore: () => {
    getConfig: () => { openclawConfigSource?: unknown; agentEngine?: unknown };
    listRecentCwds: (limit: number) => string[];
  };

  getIMGatewayManager: () => {
    getConfig: () => Record<string, any>;
    setConfig: (config: Partial<any>, options?: { syncGateway?: boolean }) => void;
    getStatus: () => Record<string, any>;
    startGateway: (platform: Platform) => Promise<void>;
    stopGateway: (platform: Platform) => Promise<void>;
    startAllEnabled: () => Promise<void>;
    testGateway: (platform: Platform, configOverride?: Partial<any>) => Promise<any>;
    weixinQrLoginStart: () => Promise<{ qrCode?: string; expiresAt?: number }>;
    weixinQrLoginWait: (accountId?: string) => Promise<{ connected: boolean; [key: string]: unknown }>;
    getOpenClawConfigSchema: () => Promise<any>;
    getIMStore: () => {
      setFeishuInstanceConfigForEngine: (engineKey: string, instanceId: string, config: any) => void;
      setFeishuManagementMode: (mode: string) => void;
      setFeishuRuntimeOwnership: (engineKey: string, ownership: string) => void;
      getFeishuInstances: (engineKey: string) => any[];
      getFeishuManagementMode: () => string;
      getFeishuRuntimeOwnership: (engineKey: string) => string;
      setDingTalkInstanceConfig: (instanceId: string, config: any) => void;
      deleteDingTalkInstance: (instanceId: string) => void;
      setQQInstanceConfig: (instanceId: string, config: any) => void;
      deleteQQInstance: (instanceId: string) => void;
      deleteFeishuInstanceForEngine: (engineKey: string, instanceId: string) => void;
    };
    startFeishuInstallQrcode: (isLark: boolean) => Promise<any>;
    pollFeishuInstall: (deviceCode: string) => Promise<any>;
    verifyFeishuCredentials: (appId: string, appSecret: string) => Promise<any>;
  };

  getOpenClawEngineManager: () => {
    getStatus: () => { phase: string };
    getLocalChannelStatus: () => { feishuConfigured?: boolean; feishuRunning?: boolean };
    getStateDir: () => string;
    restartGateway: () => Promise<any>;
    setExternalError: (error: string) => any;
  };

  getHermesEngineManager: () => {
    getStatus: () => { phase: string };
    restartGateway: () => Promise<{ phase: string; message?: string }>;
    stopGateway: () => Promise<void>;
  };

  getOpenClawConfigSync: () => {
    sync: (reason: string) => { ok: boolean; skipped?: boolean; error?: string };
    collectSecretEnvVars: () => Record<string, string>;
  };

  getHermesConfigSync: () => {
    sync: (reason: string) => { success: boolean; changed?: boolean; error?: string };
  };

  openClawRuntimeAdapter: {
    connectGatewayIfNeeded: () => Promise<void>;
    hasActiveSessions: () => boolean;
    disconnectGatewayClient: () => void;
  } | null;

  syncOpenClawConfig: (options: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<{ success: boolean; changed: boolean; status?: any; error?: string }>;

  resolveFeishuIMAgentEngine: () => string | null;
  isFeishuEngineManagedByAgora: (engineKey: string) => boolean;
  normalizeFeishuEngineKey: (value: unknown) => string;
  getFeishuRuntimeOwnership: (engineKey: string) => string;
  getFeishuRuntimeOwnershipStatus: (engineKey: string, ownership: string) => any;

  transferFeishuToLocalRuntime: (
    engineKey: string,
    instances: any[],
    engineManagers: {
      openClawEngineManager: any;
      hermesEngineManager: any;
    },
  ) => Promise<{ success: boolean; status?: any; error?: string }>;

  transferFeishuToAgoraRuntime: (engineKey: string) => Promise<{ success: boolean; status?: any; error?: string }>;

  detectLocalOpenClawFeishu: () => {
    configured: boolean;
    enabled: boolean;
    [key: string]: unknown;
  };

  importOpenClawLocalFeishuConfig: () => {
    canImport: boolean;
    message?: string;
    instanceConfig?: any;
  };

  listPairingRequests: (platform: string, stateDir: string) => Array<{ code: string; expiresAt: number; status: string }>;
  readAllowFromStore: (platform: string, stateDir: string) => string[];
  approvePairingCode: (platform: string, code: string, stateDir: string) => boolean;
  rejectPairingRequest: (platform: string, code: string, stateDir: string) => boolean;
  startHermesIMSessionSyncPolling: () => void;
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
}
