/**
 * Agora Application Context
 * 
 * Centralized singleton that holds all shared state previously scattered
 * as module-level variables in main.ts. IPC handlers and services access
 * state through this context.
 * 
 * This is the first step in the main.ts decomposition:
 * - All `let xxx: Type | null = null` variables move here
 * - Getter functions ensure lazy initialization and null-safety
 * - Eventually this will be replaced by proper dependency injection
 */

import type { BrowserWindow } from 'electron';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

// Lazy-imported types (use `any` for now to avoid circular deps; will tighten later)
export type SqliteStore = any;
export type CoworkStore = any;
export type RuntimeTelemetryStore = any;
export type RuntimeTelemetryTracker = any;
export type CoworkRunner = any;
export type CoworkFileActivityTracker = any;
export type ExternalAgentProviderStore = any;
export type ExternalAgentCliInstaller = any;
export type OpenClawRuntimeAdapter = any;
export type HermesRuntimeAdapter = any;
export type ExternalCliRuntimeAdapter = any;
export type DeepSeekTuiRuntimeManager = any;
export type DeepSeekTuiRuntimeAdapter = any;
export type CoworkEngineRouter = any;
export type SkillManager = any;
export type McpStore = any;
export type McpServerManager = any;
export type McpBridgeServer = any;
export type IMGatewayManager = any;
export type OpenClawEngineManager = any;
export type OpenClawConfigSync = any;
export type HermesEngineManager = any;
export type HermesConfigSync = any;
export type AgentManager = any;

export interface McpBridgeConfig {
  port: number;
  secret: string;
}

/**
 * Global application context — the single source of truth for all runtime state.
 */
export const appContext = {
  // === Windows ===
  windows: new Set<BrowserWindow>(),
  mainWindow: null as BrowserWindow | null,
  isQuitting: false,
  lastReloadAt: 0,

  // === Core stores ===
  store: null as SqliteStore | null,
  coworkStore: null as CoworkStore | null,
  runtimeTelemetryStore: null as RuntimeTelemetryStore | null,
  storeInitPromise: null as Promise<SqliteStore> | null,

  // === Runtime ===
  runtimeTelemetryTracker: null as RuntimeTelemetryTracker | null,
  coworkRunner: null as CoworkRunner | null,
  coworkFileActivityTracker: null as CoworkFileActivityTracker | null,
  coworkEngineRouter: null as CoworkEngineRouter | null,
  coworkRuntimeForwarderBound: false,

  // === Engine adapters ===
  openClawRuntimeAdapter: null as OpenClawRuntimeAdapter | null,
  hermesRuntimeAdapter: null as HermesRuntimeAdapter | null,
  claudeCodeRuntimeAdapter: null as ExternalCliRuntimeAdapter | null,
  codexRuntimeAdapter: null as ExternalCliRuntimeAdapter | null,
  openCodeRuntimeAdapter: null as ExternalCliRuntimeAdapter | null,
  deepSeekTuiRuntimeAdapter: null as DeepSeekTuiRuntimeAdapter | null,

  // === Engine managers ===
  openClawEngineManager: null as OpenClawEngineManager | null,
  openClawConfigSync: null as OpenClawConfigSync | null,
  openClawBootstrapPromise: null as Promise<any> | null,
  openClawStatusForwarderBound: false,

  hermesEngineManager: null as HermesEngineManager | null,
  hermesConfigSync: null as HermesConfigSync | null,
  hermesBootstrapPromise: null as Promise<any> | null,
  hermesStatusForwarderBound: false,
  hermesIMSessionSyncTimer: null as ReturnType<typeof setInterval> | null,
  hermesIMSessionSyncRunning: false,
  hermesIMSessionSyncFingerprint: '',

  deepSeekTuiRuntimeManager: null as DeepSeekTuiRuntimeManager | null,

  // === External agents ===
  externalAgentProviderStore: null as ExternalAgentProviderStore | null,
  externalAgentCliInstaller: null as ExternalAgentCliInstaller | null,
  externalAgentCliInstallerForwarderBound: false,

  // === Agent manager ===
  agentManager: null as AgentManager | null,

  // === Skills ===
  skillManager: null as SkillManager | null,

  // === MCP ===
  mcpStore: null as McpStore | null,
  mcpServerManager: null as McpServerManager | null,
  mcpBridgeServer: null as McpBridgeServer | null,
  mcpBridgeSecret: null as string | null,
  mcpBridgeStartPromise: null as Promise<McpBridgeConfig | null> | null,
  mcpBridgeRefreshPromise: null as Promise<{ tools: number; error?: string }> | null,
  mcpTools: [] as any[],

  // === IM ===
  imGatewayManager: null as IMGatewayManager | null,

  // === Auth ===
  pendingAuthCode: null as string | null,
  desktopAuthCallbackServer: null as any | null,
  desktopAuthCallbackUrl: null as string | null,

  // === Token refresh ===
  pendingTokenRefresh: null as Promise<string | null> | null,

  // === Memory ===
  memoryMigrationDone: false,

  // === Prevent sleep ===
  preventSleepBlockerId: null as number | null,

  // === Deferred restart ===
  deferredRestartTimer: null as ReturnType<typeof setInterval> | null,
  deferredRestartTimeout: null as ReturnType<typeof setTimeout> | null,
} as const;

export type AppContext = typeof appContext;
