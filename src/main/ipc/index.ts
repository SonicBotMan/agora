/**
 * Agora — IPC Handler Registry
 *
 * Central registration point for all IPC handlers.
 * Each domain exports a `register*Handlers(deps)` function that
 * receives its dependencies via a typed interface, keeping
 * handlers decoupled from main.ts global state.
 *
 * Usage in main.ts:
 *   import { registerAllHandlers } from './ipc';
 *   registerAllHandlers({ getMainWindow, app, store, ... });
 */

import { BrowserWindow } from 'electron';

import { type AgentsDeps, registerAgentsHandlers } from './agentsHandlers';
import { type ApiDeps, registerApiHandlers } from './apiHandlers';
import { type AppDeps, registerAppHandlers } from './appHandlers';
import { type AuthDeps, registerAuthHandlers } from './authHandlers';
import { type CoworkAgentProviderDeps, registerCoworkAgentProviderHandlers } from './coworkAgentProviderHandlers';
import { type CoworkBootstrapDeps, registerCoworkBootstrapHandlers } from './coworkBootstrapHandlers';
import { type CoworkConfigDeps, registerCoworkConfigHandlers } from './coworkConfigHandlers';
import { registerCoworkExportHandlers } from './coworkExportHandlers';
import { type CoworkMemoryDeps, registerCoworkMemoryHandlers } from './coworkMemoryHandlers';
import { type CoworkRuntimeDeps, registerCoworkRuntimeHandlers } from './coworkRuntimeHandlers';
import { type DialogDeps, registerDialogHandlers } from './dialogHandlers';
import { type EngineDeps, registerEngineHandlers } from './engineHandlers';
import {
  type FrontendStationDeps,
  registerFrontendStationHandlers,
} from './frontendStationHandlers';
import {
  type HotTopicsDeps,
  registerHotTopicsHandlers,
} from './hotTopicsHandlers';
import { type ImCoreDeps, registerImCoreHandlers } from './imCoreHandlers';
import { type ImDeps } from './imDeps';
import {
  type ImFeishuInstanceDeps,
  registerImFeishuInstanceHandlers,
} from './imFeishuInstanceHandlers';
import {
  type ImFeishuManagementDeps,
  registerImFeishuManagementHandlers,
} from './imFeishuManagementHandlers';
import { type ImInstanceDeps, registerImInstanceHandlers } from './imInstanceHandlers';
import { type ImPairingDeps, registerImPairingHandlers } from './imPairingHandlers';
import {
  type KnowledgeDeps,
  registerKnowledgeHandlers,
} from './knowledgeHandlers';
import { type LogDeps, registerLogHandlers } from './logHandlers';
import { type McpDeps, registerMcpHandlers } from './mcpHandlers';
import {
  type OrchestratorDeps,
  registerOrchestratorHandlers,
} from './orchestratorHandlers';
import { type PermissionDeps, registerPermissionHandlers } from './permissionHandlers';
import {
  registerResearchHandlers,
  type ResearchDeps,
} from './researchHandlers';
import type { SessionDeps } from './sessionDeps';
import { registerSessionHandlers } from './sessionHandlers';
import { registerShellHandlers, type ShellDeps } from './shellHandlers';
import { registerSkillHandlers, type SkillDeps } from './skillHandlers';
import { registerStoreHandlers, type StoreDeps } from './storeHandlers';
import { registerUpdateHandlers, type UpdateDeps } from './updateHandlers';
import { registerWindowHandlers } from './windowHandlers';

/**
 * Aggregated dependencies for all handler groups.
 * main.ts constructs this object from its module-level state.
 */
export interface AllHandlerDeps {
  getMainWindow: () => BrowserWindow | null;

  // Store (direct pass-through)
  getStore: <T = unknown>(key: string, defaultValue?: T) => T;
  setStore: (key: string, value: unknown) => void;
  deleteStoreKey: (key: string) => void;
  onAppConfigChanged?: () => Promise<void>;

  // App
  app: AppDeps;

  // Shell
  shell: ShellDeps;

  // Permissions
  permissions: PermissionDeps;

  // Updates
  updates: UpdateDeps;

  // Logs
  logs: LogDeps;

  // Auth
  auth: AuthDeps;

  // Skills
  skills: SkillDeps;

  // Sessions / Cowork
  sessions: SessionDeps;
  research: ResearchDeps;
  knowledge: KnowledgeDeps;
  hotTopics: HotTopicsDeps;
  frontendStation: FrontendStationDeps;

  // IM
  im: ImDeps;

  // Engines
  engines: EngineDeps;

  // Agents
  agents: AgentsDeps;

  // MCP
  mcp: McpDeps;

  // API / Copilot / github-copilot
  api: ApiDeps;
}

/**
 * Register all IPC handler groups.
 * Called once during app initialization (inside gotTheLock block).
 */
export function registerAllHandlers(deps: AllHandlerDeps): void {
  registerWindowHandlers(deps.getMainWindow);
  registerAppHandlers(deps.app);
  registerStoreHandlers({
    getStore: deps.getStore,
    setStore: deps.setStore,
    deleteStoreKey: deps.deleteStoreKey,
    onAppConfigChanged: deps.onAppConfigChanged,
  });
  registerDialogHandlers({ getMainWindow: deps.getMainWindow });
  registerShellHandlers(deps.shell);
  registerPermissionHandlers(deps.permissions);
  registerUpdateHandlers(deps.updates);
  registerLogHandlers(deps.logs);
  registerAuthHandlers(deps.auth);
  registerSkillHandlers(deps.skills);
  registerSessionHandlers(deps.sessions);
  registerCoworkExportHandlers();
  registerCoworkRuntimeHandlers(deps.sessions);
  registerCoworkAgentProviderHandlers(deps.sessions);
  registerCoworkBootstrapHandlers(deps.sessions);
  registerCoworkConfigHandlers(deps.sessions);
  registerCoworkMemoryHandlers(deps.sessions);
  registerOrchestratorHandlers(deps.sessions);
  registerResearchHandlers(deps.research);
  registerKnowledgeHandlers(deps.knowledge);
  registerHotTopicsHandlers(deps.hotTopics);
  registerFrontendStationHandlers(deps.frontendStation);
  registerImCoreHandlers(deps.im);
  registerImFeishuManagementHandlers(deps.im);
  registerImFeishuInstanceHandlers(deps.im);
  registerImPairingHandlers(deps.im);
  registerImInstanceHandlers(deps.im);
  registerEngineHandlers(deps.engines);
  registerAgentsHandlers(deps.agents);
  registerMcpHandlers(deps.mcp);
  registerApiHandlers(deps.api);
}

/**
 * Re-export all deps interfaces for convenience.
 */
export type {
  AgentsDeps,
  AllHandlerDeps as AgoraHandlerDeps,
  ApiDeps,
  AppDeps,
  AuthDeps,
  CoworkAgentProviderDeps,
  CoworkBootstrapDeps,
  CoworkConfigDeps,
  CoworkMemoryDeps,
  CoworkRuntimeDeps,
  DialogDeps,
  EngineDeps,
  FrontendStationDeps,
  HotTopicsDeps,
  ImCoreDeps,
  ImDeps,
  ImFeishuInstanceDeps,
  ImFeishuManagementDeps,
  ImInstanceDeps,
  ImPairingDeps,
  KnowledgeDeps,
  LogDeps,
  McpDeps,
  OrchestratorDeps,
  PermissionDeps,
  ResearchDeps,
  ShellDeps,
  SkillDeps,
  StoreDeps,
  UpdateDeps,
};

export type { SessionDeps } from './sessionDeps';
