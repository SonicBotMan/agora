/**
 * Top-level IPC facade that preserves the documented `src/ipc/*` surface
 * while delegating to the real main-process implementation in `src/main/ipc`.
 */

import {
  type AllHandlerDeps,
  registerAllHandlers,
} from '../main/ipc';

export function registerAllIpcHandlers(deps: AllHandlerDeps): void {
  registerAllHandlers(deps);
}

export type { AllHandlerDeps as IpcFacadeDeps } from '../main/ipc';
export type { AttachmentDeps } from './attachmentHandlers';
export { registerAttachmentHandlers } from './attachmentHandlers';
export type { EngineDeps } from './engineHandlers';
export { registerEngineHandlers } from './engineHandlers';
export type { FrontendStationDeps } from './frontendStationHandlers';
export { registerFrontendStationHandlers } from './frontendStationHandlers';
export type { HotTopicsDeps } from './hotTopicsHandlers';
export { registerHotTopicsHandlers } from './hotTopicsHandlers';
export type { ImDeps } from './imHandlers';
export { registerImHandlers } from './imHandlers';
export type { KnowledgeDeps } from './knowledgeHandlers';
export { registerKnowledgeHandlers } from './knowledgeHandlers';
export type { McpDeps } from './mcpHandlers';
export { registerMcpHandlers } from './mcpHandlers';
export type { OrchestratorDeps } from './orchestratorHandlers';
export { registerOrchestratorHandlers } from './orchestratorHandlers';
export type { PermissionDeps } from './permissionHandlers';
export { registerPermissionHandlers } from './permissionHandlers';
export type { ResearchDeps } from './researchHandlers';
export { registerResearchHandlers } from './researchHandlers';
export type { SessionDeps } from './sessionHandlers';
export { registerSessionHandlers } from './sessionHandlers';
export type { SkillDeps } from './skillHandlers';
export { registerSkillHandlers } from './skillHandlers';
export type { IpcHandlerRegistration } from './types';
