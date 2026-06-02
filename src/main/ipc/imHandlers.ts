/**
 * Agora — IM (Instant Messaging) IPC Handlers
 *
 * Extracted from main.ts lines ~4984–5649.
 * Handles: IM config CRUD, gateway lifecycle, WeChat QR login,
 * Feishu detection/management/runtime-ownership, DingTalk/QQ instances,
 * IM pairing operations, and Feishu bot install helpers.
 *
 * This is the second-largest handler group (~31 handlers).
 */

import crypto from 'crypto';
import os from 'os';
import { ipcMain } from 'electron';
import {
  CoworkAgentEngine as CoworkAgentEngineValue,
} from '../../shared/cowork/constants';
import {
  FeishuEngineKey,
  FeishuImportSource,
  FeishuManagementMode,
  FeishuRuntimeOwnership,
  ImIpcChannel,
  isFeishuEngineKey,
  isFeishuManagementMode,
  isFeishuRuntimeOwnership,
  type FeishuEngineKeyType,
  type FeishuRuntimeOwnershipType,
} from '../../shared/im/constants';
import type { Platform } from '../im/types';

// ---------------------------------------------------------------------------
// Internal state (previously closures in main.ts)
// ---------------------------------------------------------------------------

/**
 * Debounce + serialization for im:config:set → syncOpenClawConfig.
 * Rapid sequential config changes (e.g. toggling 4 platforms) are coalesced
 * into a single gateway restart instead of N restarts.
 */
let imConfigSyncTimer: ReturnType<typeof setTimeout> | null = null;
let imConfigSyncRunning = false;
let imConfigSyncPending = false;
const IM_CONFIG_SYNC_DEBOUNCE_MS = 600;

// ---------------------------------------------------------------------------
// Dependencies injected by main.ts
// ---------------------------------------------------------------------------

export interface ImDeps {
  /** Low-level key-value store (SqliteStore). */
  getStore: () => {
    get: <T = unknown>(key: string) => T | undefined;
    set: <T = unknown>(key: string, value: T) => void;
    delete: (key: string) => void;
  };

  /** Cowork (workspace) store. */
  getCoworkStore: () => {
    getConfig: () => { openclawConfigSource?: unknown; agentEngine?: unknown };
    listRecentCwds: (limit: number) => string[];
  };

  /** IM gateway manager — config, instances, gateway lifecycle, Feishu install. */
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

  /** OpenClaw engine manager — status, stateDir, secret env, gateway lifecycle. */
  getOpenClawEngineManager: () => {
    getStatus: () => { phase: string };
    getLocalChannelStatus: () => { feishuConfigured?: boolean; feishuRunning?: boolean };
    getStateDir: () => string;
    restartGateway: () => Promise<any>;
    setExternalError: (error: string) => any;
  };

  /** Hermes engine manager — status, gateway lifecycle. */
  getHermesEngineManager: () => {
    getStatus: () => { phase: string };
    restartGateway: () => Promise<{ phase: string; message?: string }>;
    stopGateway: () => Promise<void>;
  };

  /** OpenClaw config sync helper. */
  getOpenClawConfigSync: () => {
    sync: (reason: string) => { ok: boolean; skipped?: boolean; error?: string };
    collectSecretEnvVars: () => Record<string, string>;
  };

  /** Hermes config sync helper. */
  getHermesConfigSync: () => {
    sync: (reason: string) => { success: boolean; changed?: boolean; error?: string };
  };

  /** OpenClaw runtime adapter (nullable — used for gateway client connection). */
  openClawRuntimeAdapter: {
    connectGatewayIfNeeded: () => Promise<void>;
    hasActiveSessions: () => boolean;
    disconnectGatewayClient: () => void;
  } | null;

  /** Sync OpenClaw config to disk and optionally restart gateway. */
  syncOpenClawConfig: (options: {
    reason: string;
    restartGatewayIfRunning?: boolean;
  }) => Promise<{ success: boolean; changed: boolean; status?: any; error?: string }>;

  /** Resolve which agent engine handles Feishu IM (OpenClaw | Hermes | ClaudeCode | Codex | null). */
  resolveFeishuIMAgentEngine: () => string | null;

  /** Whether a given Feishu engine key is managed by Agora (vs local). */
  isFeishuEngineManagedByAgora: (engineKey: string) => boolean;

  /** Normalize an unknown value to a valid FeishuEngineKey. */
  normalizeFeishuEngineKey: (value: unknown) => string;

  /** Get current Feishu runtime ownership mode for an engine key. */
  getFeishuRuntimeOwnership: (engineKey: string) => string;

  /** Get Feishu runtime ownership status (derived from current state). */
  getFeishuRuntimeOwnershipStatus: (engineKey: string, ownership: string) => any;

  /** Transfer Feishu instances to local runtime (plugin-managed). */
  transferFeishuToLocalRuntime: (
    engineKey: string,
    instances: any[],
    engineManagers: {
      openClawEngineManager: any;
      hermesEngineManager: any;
    },
  ) => Promise<{ success: boolean; status?: any; error?: string }>;

  /** Transfer Feishu instances back to Agora-managed runtime. */
  transferFeishuToAgoraRuntime: (engineKey: string) => Promise<{ success: boolean; status?: any; error?: string }>;

  /** Detect local OpenClaw Feishu configuration. */
  detectLocalOpenClawFeishu: () => {
    configured: boolean;
    enabled: boolean;
    [key: string]: unknown;
  };

  /** Import local OpenClaw Feishu config into Agora's IM store. */
  importOpenClawLocalFeishuConfig: () => {
    canImport: boolean;
    message?: string;
    instanceConfig?: any;
  };

  /** List pairing requests for a platform. */
  listPairingRequests: (platform: string, stateDir: string) => Array<{ code: string; expiresAt: number; status: string }>;

  /** Read allow-from store for a platform. */
  readAllowFromStore: (platform: string, stateDir: string) => string[];

  /** Approve a pairing code. */
  approvePairingCode: (platform: string, code: string, stateDir: string) => boolean;

  /** Reject a pairing request. */
  rejectPairingRequest: (platform: string, code: string, stateDir: string) => boolean;

  /** Start Hermes IM session sync polling. */
  startHermesIMSessionSyncPolling: () => void;

  /** Sync Hermes IM sessions to cowork store. */
  syncHermesIMSessionsToCowork: (reason: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal helpers (previously closures in main.ts)
// ---------------------------------------------------------------------------

function hasEnabledOpenClawManagedIMPlatform(deps: ImDeps): boolean {
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

async function doImConfigSync(deps: ImDeps): Promise<void> {
  imConfigSyncRunning = true;
  try {
    await deps.syncOpenClawConfig({
      reason: 'im-config-change',
      restartGatewayIfRunning: true,
    });
    // After config sync, ensure the runtime adapter's WebSocket client
    // is connected so channel events are received.
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

function scheduleImConfigSync(deps: ImDeps): void {
  if (imConfigSyncRunning) {
    // A sync is already in progress; mark pending so it re-runs after completion.
    imConfigSyncPending = true;
    return;
  }
  if (imConfigSyncTimer) clearTimeout(imConfigSyncTimer);
  imConfigSyncTimer = setTimeout(() => {
    imConfigSyncTimer = null;
    void doImConfigSync(deps);
  }, IM_CONFIG_SYNC_DEBOUNCE_MS);
}

function shouldSyncRunningIMGatewayConfig(deps: ImDeps): boolean {
  return (
    deps.getOpenClawEngineManager().getStatus().phase === 'running'
    || deps.getHermesEngineManager().getStatus().phase === 'running'
    || deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.Hermes
    || deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.ClaudeCode
    || deps.resolveFeishuIMAgentEngine() === CoworkAgentEngineValue.Codex
  );
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerImHandlers(deps: ImDeps): void {
  // ---- IM Config ----

  // im:config:get — Return the full IM gateway config.
  ipcMain.handle('im:config:get', async () => {
    try {
      const config = deps.getIMGatewayManager().getConfig();
      return { success: true, config };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get IM config',
      };
    }
  });

  // im:config:set — Persist partial config. When syncGateway is set and the
  // config change involves an OpenClaw-managed platform, debounce a gateway
  // restart via scheduleImConfigSync.
  ipcMain.handle('im:config:set', async (_event, config: Partial<any>, options?: { syncGateway?: boolean }) => {
    try {
      deps.getIMGatewayManager().setConfig(config, { syncGateway: options?.syncGateway });

      // Detect whether the change touches an OpenClaw-managed platform.
      const hasOpenClawChange = (config as any).telegram || (config as any).discord || (config as any).dingtalk
        || (config as any).feishu || (config as any).qq || (config as any).wecom || (config as any).popo || (config as any).weixin;
      if (options?.syncGateway && hasOpenClawChange && shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set IM config',
      };
    }
  });

  // im:config:sync — Explicitly trigger OpenClaw config sync + gateway restart.
  // Called from the global Settings Save button after config fields have been
  // persisted to DB via im:config:set (without syncGateway flag).
  ipcMain.handle('im:config:sync', async () => {
    try {
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync IM config',
      };
    }
  });

  // ---- Gateway Lifecycle ----

  // im:gateway:start — Persist enabled state and start the gateway for a platform.
  ipcMain.handle('im:gateway:start', async (_event, platform: Platform) => {
    try {
      const manager = deps.getIMGatewayManager();
      manager.setConfig({ [platform]: { enabled: true } } as any);
      await manager.startGateway(platform);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start gateway',
      };
    }
  });

  // im:gateway:stop — Persist disabled state and stop the gateway for a platform.
  ipcMain.handle('im:gateway:stop', async (_event, platform: Platform) => {
    try {
      const manager = deps.getIMGatewayManager();
      manager.setConfig({ [platform]: { enabled: false } } as any);
      await manager.stopGateway(platform);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop gateway',
      };
    }
  });

  // im:gateway:test — Test connectivity for a platform with optional config override.
  ipcMain.handle('im:gateway:test', async (
    _event,
    platform: Platform,
    configOverride?: Partial<any>,
  ) => {
    try {
      const result = await deps.getIMGatewayManager().testGateway(platform, configOverride);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test gateway connectivity',
      };
    }
  });

  // ---- WeChat (Weixin) QR Login ----

  // im:weixin:qr-login-start — Start a Weixin QR code login flow.
  ipcMain.handle('im:weixin:qr-login-start', async () => {
    try {
      const result = await deps.getIMGatewayManager().weixinQrLoginStart();
      return { success: true, ...result };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Failed to start Weixin QR login' };
    }
  });

  // im:weixin:qr-login-wait — Poll/await Weixin QR code login completion.
  // On successful connection, restart the OpenClaw gateway so the plugin picks
  // up the new token and starts a fresh monitor loop.
  ipcMain.handle('im:weixin:qr-login-wait', async (_event, accountId?: string) => {
    try {
      const result = await deps.getIMGatewayManager().weixinQrLoginWait(accountId);
      if (result.connected) {
        console.log('[IMGatewayManager] Weixin login succeeded, restarting OpenClaw gateway');
        await deps.getOpenClawEngineManager().restartGateway();
      }
      return { success: true, ...result };
    } catch (error) {
      return { success: false, connected: false, message: error instanceof Error ? error.message : 'Weixin QR login failed' };
    }
  });

  // ---- IM Status ----

  // im:status:get — Return full IM gateway status.
  ipcMain.handle('im:status:get', async () => {
    try {
      const status = deps.getIMGatewayManager().getStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get IM status',
      };
    }
  });

  // im:getLocalIp — Return the first non-internal IPv4 address.
  ipcMain.handle('im:getLocalIp', () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  });

  // im:openclaw:config-schema — Return the OpenClaw config JSON schema.
  ipcMain.handle('im:openclaw:config-schema', async () => {
    try {
      const result = await deps.getIMGatewayManager().getOpenClawConfigSchema();
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get OpenClaw config schema',
      };
    }
  });

  // ---- Feishu Detection / Import ----

  // im:feishu:detect-openclaw-local — Check if a local OpenClaw Feishu config exists.
  ipcMain.handle(ImIpcChannel.FeishuDetectOpenClawLocal, async () => {
    try {
      return {
        success: true,
        result: deps.detectLocalOpenClawFeishu(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect local OpenClaw Feishu config',
      };
    }
  });

  // im:feishu:import-openclaw-local — Import local OpenClaw Feishu config into Agora's IM store.
  ipcMain.handle(ImIpcChannel.FeishuImportOpenClawLocal, async () => {
    try {
      const candidate = deps.importOpenClawLocalFeishuConfig();
      if (!candidate.canImport) {
        return {
          success: false,
          error: candidate.message || 'No importable local OpenClaw Feishu config was found.',
        };
      }
      const instanceId = crypto.randomUUID();
      const instance = {
        ...candidate.instanceConfig,
        instanceId,
        instanceName: 'OpenClaw Feishu Bot',
        enabled: false,
        importSource: FeishuImportSource.OpenClawLocal,
      };
      deps.getIMGatewayManager().getIMStore().setFeishuInstanceConfigForEngine(FeishuEngineKey.OpenClaw, instanceId, {
        ...instance,
        engineKey: FeishuEngineKey.OpenClaw,
      });
      deps.getIMGatewayManager().getIMStore().setFeishuManagementMode(FeishuManagementMode.LocalOpenClaw);
      return {
        success: true,
        instance,
        result: deps.detectLocalOpenClawFeishu(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import local OpenClaw Feishu config',
      };
    }
  });

  // ---- Feishu Management Mode ----

  // im:feishu:set-management-mode — Switch between LocalOpenClaw and AgoraManaged.
  ipcMain.handle(ImIpcChannel.FeishuSetManagementMode, async (_event, mode: unknown) => {
    try {
      if (!isFeishuManagementMode(mode)) {
        return {
          success: false,
          error: 'Invalid Feishu management mode.',
        };
      }
      deps.getIMGatewayManager().getIMStore().setFeishuManagementMode(mode);
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      if (mode === FeishuManagementMode.LocalOpenClaw) {
        await deps.getIMGatewayManager().stopGateway('feishu' as Platform).catch((error) => {
          console.warn('[IM] Failed to stop native Feishu gateway after management mode switch:', error);
        });
      } else {
        await deps.getIMGatewayManager().startAllEnabled().catch((error) => {
          console.warn('[IM] Failed to restart Feishu gateway after management mode switch:', error);
        });
      }
      return {
        success: true,
        mode,
        status: deps.getIMGatewayManager().getStatus().feishu?.openClawLocal,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Feishu management mode',
      };
    }
  });

  // ---- Feishu Runtime Ownership ----

  // im:feishu:set-runtime-ownership — Transfer Feishu instances between local
  // and Agora-managed runtime.
  ipcMain.handle(ImIpcChannel.FeishuSetRuntimeOwnership, async (_event, input: unknown) => {
    try {
      const record = input && typeof input === 'object' && !Array.isArray(input)
        ? input as { engineKey?: unknown; ownership?: unknown }
        : {};
      if (!isFeishuEngineKey(record.engineKey)) {
        return {
          success: false,
          error: 'Invalid Feishu engine ownership target.',
        };
      }
      if (record.engineKey !== FeishuEngineKey.OpenClaw && record.engineKey !== FeishuEngineKey.Hermes) {
        return {
          success: false,
          error: 'Only OpenClaw and Hermes Agent support local runtime ownership.',
        };
      }
      if (!isFeishuRuntimeOwnership(record.ownership)) {
        return {
          success: false,
          error: 'Invalid Feishu runtime ownership mode.',
        };
      }

      const manager = deps.getIMGatewayManager();
      const engineKey = record.engineKey as string;
      const ownership = record.ownership as string;
      const transferResult = ownership === FeishuRuntimeOwnership.LocalRuntime
        ? await deps.transferFeishuToLocalRuntime(
          engineKey,
          manager.getIMStore().getFeishuInstances(engineKey),
          {
            openClawEngineManager: deps.getOpenClawEngineManager(),
            hermesEngineManager: deps.getHermesEngineManager(),
          },
        )
        : await deps.transferFeishuToAgoraRuntime(engineKey);

      if (!transferResult.success) {
        return transferResult;
      }

      manager.getIMStore().setFeishuRuntimeOwnership(engineKey, ownership);
      if (ownership === FeishuRuntimeOwnership.LocalRuntime) {
        await manager.stopGateway('feishu' as Platform).catch((error) => {
          console.warn('[IM] Failed to stop Agora Feishu gateway after local runtime ownership switch:', error);
        });
      } else {
        if (shouldSyncRunningIMGatewayConfig(deps)) {
          scheduleImConfigSync(deps);
        }
        await manager.startAllEnabled().catch((error) => {
          console.warn('[IM] Failed to restart Feishu gateway after Agora ownership switch:', error);
        });
      }

      return {
        success: true,
        ownership,
        status: transferResult.status ?? deps.getFeishuRuntimeOwnershipStatus(engineKey, ownership),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Feishu runtime ownership.',
      };
    }
  });

  // im:feishu:refresh-runtime-ownership — Refresh the runtime ownership status
  // for a given engine key without making changes.
  ipcMain.handle(ImIpcChannel.FeishuRefreshRuntimeOwnership, async (_event, engineKeyInput: unknown) => {
    try {
      const engineKey = deps.normalizeFeishuEngineKey(engineKeyInput);
      const ownership = deps.getFeishuRuntimeOwnership(engineKey);
      return {
        success: true,
        ownership,
        status: deps.getFeishuRuntimeOwnershipStatus(engineKey, ownership),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh Feishu runtime ownership status.',
      };
    }
  });

  // ---- IM Pairing ----

  // im:pairing:list — List pairing requests and allowed addresses for a platform.
  ipcMain.handle('im:pairing:list', async (_event, platform: string) => {
    try {
      const stateDir = deps.getOpenClawEngineManager().getStateDir();
      const requests = deps.listPairingRequests(platform, stateDir);
      const allowFrom = deps.readAllowFromStore(platform, stateDir);
      return { success: true, requests, allowFrom };
    } catch (error) {
      return {
        success: false,
        requests: [],
        allowFrom: [],
        error: error instanceof Error ? error.message : 'Failed to list pairing requests',
      };
    }
  });

  // im:pairing:approve — Approve a pending pairing code.
  ipcMain.handle('im:pairing:approve', async (_event, platform: string, code: string) => {
    try {
      const stateDir = deps.getOpenClawEngineManager().getStateDir();
      const approved = deps.approvePairingCode(platform, code, stateDir);
      if (!approved) {
        return { success: false, error: 'Pairing code not found or expired' };
      }
      await deps.syncOpenClawConfig({
        reason: `im-pairing-approval:${platform}`,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve pairing code',
      };
    }
  });

  // im:pairing:reject — Reject/remove a pending pairing request.
  ipcMain.handle('im:pairing:reject', async (_event, platform: string, code: string) => {
    try {
      const stateDir = deps.getOpenClawEngineManager().getStateDir();
      const rejected = deps.rejectPairingRequest(platform, code, stateDir);
      if (!rejected) {
        return { success: false, error: 'Pairing code not found or expired' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject pairing request',
      };
    }
  });

  // ---- DingTalk Multi-Instance ----

  // im:dingtalk:instance:add — Create a new DingTalk instance with defaults.
  ipcMain.handle('im:dingtalk:instance:add', async (_event, name: string) => {
    try {
      const instanceId = crypto.randomUUID();
      const { DEFAULT_DINGTALK_OPENCLAW_CONFIG: defaults } = await import('../im/types');
      const instance = {
        ...defaults,
        instanceId,
        instanceName: name || 'DingTalk Bot',
      };
      deps.getIMGatewayManager().getIMStore().setDingTalkInstanceConfig(instanceId, instance);
      return { success: true, instance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add DingTalk instance',
      };
    }
  });

  // im:dingtalk:instance:delete — Delete a DingTalk instance.
  ipcMain.handle('im:dingtalk:instance:delete', async (_event, instanceId: string) => {
    try {
      deps.getIMGatewayManager().getIMStore().deleteDingTalkInstance(instanceId);
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete DingTalk instance',
      };
    }
  });

  // im:dingtalk:instance:config:set — Update config for a specific DingTalk instance.
  ipcMain.handle('im:dingtalk:instance:config:set', async (_event, instanceId: string, config: any, options?: { syncGateway?: boolean }) => {
    try {
      deps.getIMGatewayManager().getIMStore().setDingTalkInstanceConfig(instanceId, config);
      if (options?.syncGateway && shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set DingTalk instance config',
      };
    }
  });

  // ---- QQ Multi-Instance ----

  // im:qq:instance:add — Create a new QQ instance with defaults.
  ipcMain.handle('im:qq:instance:add', async (_event, name: string) => {
    try {
      const instanceId = crypto.randomUUID();
      const { DEFAULT_QQ_CONFIG: defaults } = await import('../im/types');
      const instance = {
        ...defaults,
        instanceId,
        instanceName: name || 'QQ Bot',
      };
      deps.getIMGatewayManager().getIMStore().setQQInstanceConfig(instanceId, instance);
      return { success: true, instance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add QQ instance',
      };
    }
  });

  // im:qq:instance:delete — Delete a QQ instance.
  ipcMain.handle('im:qq:instance:delete', async (_event, instanceId: string) => {
    try {
      deps.getIMGatewayManager().getIMStore().deleteQQInstance(instanceId);
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete QQ instance',
      };
    }
  });

  // im:qq:instance:config:set — Update config for a specific QQ instance.
  ipcMain.handle('im:qq:instance:config:set', async (_event, instanceId: string, config: any, options?: { syncGateway?: boolean }) => {
    try {
      deps.getIMGatewayManager().getIMStore().setQQInstanceConfig(instanceId, config);
      if (options?.syncGateway && shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set QQ instance config',
      };
    }
  });

  // ---- Feishu Multi-Instance ----

  // im:feishu:instance:add — Create a new Feishu instance with defaults.
  ipcMain.handle('im:feishu:instance:add', async (_event, name: string, engineKeyValue?: unknown) => {
    try {
      const engineKey = deps.normalizeFeishuEngineKey(engineKeyValue);
      const instanceId = crypto.randomUUID();
      const { DEFAULT_FEISHU_OPENCLAW_CONFIG: defaults } = await import('../im/types');
      const instance = {
        ...defaults,
        instanceId,
        instanceName: name || 'Feishu Bot',
        engineKey,
      };
      deps.getIMGatewayManager().getIMStore().setFeishuInstanceConfigForEngine(engineKey, instanceId, instance);
      return { success: true, instance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add Feishu instance',
      };
    }
  });

  // im:feishu:instance:delete — Delete a Feishu instance.
  ipcMain.handle('im:feishu:instance:delete', async (_event, instanceId: string, engineKeyValue?: unknown) => {
    try {
      const engineKey = deps.normalizeFeishuEngineKey(engineKeyValue);
      deps.getIMGatewayManager().getIMStore().deleteFeishuInstanceForEngine(engineKey, instanceId);
      if (shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete Feishu instance',
      };
    }
  });

  // im:feishu:instance:config:set — Update config for a specific Feishu instance.
  ipcMain.handle('im:feishu:instance:config:set', async (_event, instanceId: string, config: any, options?: { syncGateway?: boolean; engineKey?: unknown }) => {
    try {
      const engineKey = deps.normalizeFeishuEngineKey(options?.engineKey ?? config?.engineKey);
      deps.getIMGatewayManager().getIMStore().setFeishuInstanceConfigForEngine(engineKey, instanceId, {
        ...config,
        engineKey,
      });
      if (options?.syncGateway && shouldSyncRunningIMGatewayConfig(deps)) {
        scheduleImConfigSync(deps);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set Feishu instance config',
      };
    }
  });

  // ---- Feishu Bot Install Helpers ----

  // feishu:install:qrcode — Start the Feishu bot installation QR code flow.
  ipcMain.handle('feishu:install:qrcode', async (_event, { isLark }: { isLark: boolean }) => {
    try {
      return await deps.getIMGatewayManager().startFeishuInstallQrcode(isLark);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取二维码失败');
    }
  });

  // feishu:install:poll — Poll the Feishu installation status.
  ipcMain.handle('feishu:install:poll', async (_event, { deviceCode }: { deviceCode: string }) => {
    try {
      return await deps.getIMGatewayManager().pollFeishuInstall(deviceCode);
    } catch (error) {
      return { done: false, error: error instanceof Error ? error.message : '轮询失败' };
    }
  });

  // feishu:install:verify — Verify Feishu credentials (appId + appSecret).
  ipcMain.handle('feishu:install:verify', async (_event, { appId, appSecret }: { appId: string; appSecret: string }) => {
    try {
      return await deps.getIMGatewayManager().verifyFeishuCredentials(appId, appSecret);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '验证失败' };
    }
  });
}
