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
import { registerWindowHandlers } from './windowHandlers';
import { registerAppHandlers, type AppDeps } from './appHandlers';
import { registerStoreHandlers, type StoreDeps } from './storeHandlers';
import { registerDialogHandlers, type DialogDeps } from './dialogHandlers';
import { registerShellHandlers, type ShellDeps } from './shellHandlers';
import { registerPermissionHandlers, type PermissionDeps } from './permissionHandlers';
import { registerUpdateHandlers, type UpdateDeps } from './updateHandlers';
import { registerLogHandlers, type LogDeps } from './logHandlers';
import { registerAuthHandlers, type AuthDeps } from './authHandlers';
import { registerSkillHandlers, type SkillDeps } from './skillHandlers';
import { registerSessionHandlers, type SessionDeps } from './sessionHandlers';
import { registerImHandlers, type ImDeps } from './imHandlers';
import { registerEngineHandlers, type EngineDeps } from './engineHandlers';
import { registerAgentsHandlers, type AgentsDeps } from './agentsHandlers';
import { registerMcpHandlers, type McpDeps } from './mcpHandlers';
import { registerApiHandlers, type ApiDeps } from './apiHandlers';

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
  registerImHandlers(deps.im);
  registerEngineHandlers(deps.engines);
  registerAgentsHandlers(deps.agents);
  registerMcpHandlers(deps.mcp);
  registerApiHandlers(deps.api);
}

/**
 * Re-export all deps interfaces for convenience.
 */
export type {
  AllHandlerDeps as AgoraHandlerDeps,
  AppDeps,
  StoreDeps,
  DialogDeps,
  ShellDeps,
  PermissionDeps,
  UpdateDeps,
  LogDeps,
  AuthDeps,
  SkillDeps,
  SessionDeps,
  ImDeps,
  EngineDeps,
  AgentsDeps,
  McpDeps,
  ApiDeps,
};
