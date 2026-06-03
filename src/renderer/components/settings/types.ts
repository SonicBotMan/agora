/**
 * Settings — Shared Types
 *
 * Types referenced by both Settings.tsx and the per-tab sub-components.
 * The TabType union is the navigation state machine for the settings dialog.
 */

export type TabType =
  | 'general'
  | 'coworkAgentEngine'
  | 'model'
  | 'coworkMemory'
  | 'coworkAgent'
  | 'agents'
  | 'shortcuts'
  | 'im'
  | 'email'
  | 'scheduledTasks'
  | 'mcp'
  | 'about';
