import path from 'path';

import {
  CoworkSessionKind,
  isCoworkAgentEngine,
  isCoworkSessionKind,
} from '../../shared/cowork/constants';
import type { CoworkSessionRuntimeSnapshot } from '../../shared/cowork/runtimeSnapshot';
import type {
  CoworkExecutionMode,
  CoworkImportedSessionInput,
  CoworkMessage,
  CoworkSession,
  CoworkSessionStatus,
  CoworkSessionSummary,
} from '../coworkStoreTypes';

const TASK_WORKSPACE_CONTAINER_DIR = '.agora-tasks';

export interface SessionRow {
  id: string;
  title: string;
  claude_session_id: string | null;
  status: string;
  pinned?: number | null;
  cwd: string;
  system_prompt: string;
  execution_mode?: string | null;
  active_skill_ids?: string | null;
  agent_id?: string | null;
  session_kind?: string | null;
  parent_session_id?: string | null;
  team_id?: string | null;
  runtime_snapshot_json?: string | null;
  created_at: number;
  updated_at: number;
}

export interface SessionSummaryRow {
  id: string;
  title: string;
  status: string;
  pinned: number | null;
  agent_id: string | null;
  session_kind: string | null;
  parent_session_id: string | null;
  team_id: string | null;
  runtime_snapshot_json: string | null;
  created_at: number;
  updated_at: number;
}

export interface ImportedSessionRow {
  title: string;
  claude_session_id: string | null;
  status: string;
  cwd: string;
  system_prompt: string;
  execution_mode: string | null;
  active_skill_ids: string | null;
  agent_id: string | null;
  session_kind: string | null;
  parent_session_id: string | null;
  team_id: string | null;
  runtime_snapshot_json: string | null;
  created_at: number;
  updated_at: number;
}

export interface CwdRow {
  cwd: string;
  updated_at: number;
}

export interface NormalizedImportedSession {
  activeSkillIdsJson: string;
  sessionKind: string;
  parentSessionId: string | null;
  teamId: string | null;
  runtimeSnapshotJson: string | null;
}

export function normalizeRecentWorkspacePath(cwd: string): string {
  const resolved = path.resolve(cwd);
  const marker = `${path.sep}${TASK_WORKSPACE_CONTAINER_DIR}${path.sep}`;
  const markerIndex = resolved.lastIndexOf(marker);
  if (markerIndex > 0) {
    return resolved.slice(0, markerIndex);
  }
  return resolved;
}

export function parseRuntimeSnapshot(
  value?: string | null,
): CoworkSessionRuntimeSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CoworkSessionRuntimeSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!isCoworkAgentEngine(parsed.agentEngine)) return null;
    return {
      agentEngine: parsed.agentEngine,
      engineLabel:
        typeof parsed.engineLabel === 'string'
          ? parsed.engineLabel
          : parsed.agentEngine,
      providerKey:
        typeof parsed.providerKey === 'string' ? parsed.providerKey : null,
      providerName:
        typeof parsed.providerName === 'string' ? parsed.providerName : null,
      modelId: typeof parsed.modelId === 'string' ? parsed.modelId : null,
      modelName:
        typeof parsed.modelName === 'string' ? parsed.modelName : null,
      modelLabel:
        typeof parsed.modelLabel === 'string' && parsed.modelLabel.trim()
          ? parsed.modelLabel
          : parsed.modelName || parsed.modelId || '',
      configSource:
        typeof parsed.configSource === 'string' ? parsed.configSource : null,
      permissionMode:
        typeof parsed.permissionMode === 'string'
          ? parsed.permissionMode
          : null,
      permissionModeLabel:
        typeof parsed.permissionModeLabel === 'string'
          ? parsed.permissionModeLabel
          : null,
      capturedAt:
        typeof parsed.capturedAt === 'number'
          ? parsed.capturedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export function parseActiveSkillIds(
  value: string | null | undefined,
  sessionId: string,
): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(
      '[CoworkStore] Failed to parse active_skill_ids for session',
      sessionId,
      error,
    );
    return [];
  }
}

export function mapSessionRow(
  row: SessionRow,
  messages: CoworkMessage[],
): CoworkSession {
  return {
    id: row.id,
    title: row.title,
    claudeSessionId: row.claude_session_id,
    status: row.status as CoworkSessionStatus,
    pinned: Boolean(row.pinned),
    cwd: row.cwd,
    systemPrompt: row.system_prompt,
    executionMode: (row.execution_mode as CoworkExecutionMode) || 'local',
    activeSkillIds: parseActiveSkillIds(row.active_skill_ids, row.id),
    agentId: row.agent_id || 'main',
    sessionKind: isCoworkSessionKind(row.session_kind)
      ? row.session_kind
      : CoworkSessionKind.Single,
    parentSessionId: row.parent_session_id || null,
    teamId: row.team_id || null,
    runtimeSnapshot: parseRuntimeSnapshot(row.runtime_snapshot_json),
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSessionSummaryRow(
  row: SessionSummaryRow,
): CoworkSessionSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status as CoworkSessionStatus,
    pinned: Boolean(row.pinned),
    agentId: row.agent_id || 'main',
    sessionKind: isCoworkSessionKind(row.session_kind)
      ? row.session_kind
      : CoworkSessionKind.Single,
    parentSessionId: row.parent_session_id || null,
    teamId: row.team_id || null,
    runtimeSnapshot: parseRuntimeSnapshot(row.runtime_snapshot_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeImportedSession(
  input: CoworkImportedSessionInput,
): NormalizedImportedSession {
  return {
    activeSkillIdsJson: JSON.stringify(input.activeSkillIds),
    sessionKind: isCoworkSessionKind(input.sessionKind)
      ? input.sessionKind
      : CoworkSessionKind.Single,
    parentSessionId: input.parentSessionId || null,
    teamId: input.teamId || null,
    runtimeSnapshotJson: input.runtimeSnapshot
      ? JSON.stringify(input.runtimeSnapshot)
      : null,
  };
}

export function hasImportedSessionChanged(
  existing: ImportedSessionRow,
  input: CoworkImportedSessionInput,
  normalized: NormalizedImportedSession,
): boolean {
  return existing.title !== input.title
    || existing.claude_session_id !== input.claudeSessionId
    || existing.status !== input.status
    || existing.cwd !== input.cwd
    || existing.system_prompt !== input.systemPrompt
    || (existing.execution_mode || 'local') !== input.executionMode
    || (existing.active_skill_ids || '[]') !== normalized.activeSkillIdsJson
    || (existing.agent_id || 'main') !== input.agentId
    || (existing.session_kind || CoworkSessionKind.Single) !== normalized.sessionKind
    || (existing.parent_session_id || null) !== normalized.parentSessionId
    || (existing.team_id || null) !== normalized.teamId
    || (existing.runtime_snapshot_json || null) !== normalized.runtimeSnapshotJson
    || existing.created_at !== input.createdAt
    || existing.updated_at !== input.updatedAt;
}
