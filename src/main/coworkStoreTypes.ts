import type {
  AgentTeamWorkflow as AgentTeamWorkflowType,
  ClaudeCodePermissionMode as ClaudeCodePermissionModeType,
  CoworkAgentEngine,
  CoworkSessionKind as CoworkSessionKindType,
  DeepSeekTuiPermissionMode as DeepSeekTuiPermissionModeType,
  ExternalAgentConfigSource as ExternalAgentConfigSourceType,
  OpenCodePermissionMode as OpenCodePermissionModeType,
} from '../shared/cowork/constants';
import type { CoworkSessionRuntimeSnapshot } from '../shared/cowork/runtimeSnapshot';
import type { CoworkMemoryGuardLevel } from './libs/coworkMemoryExtractor';

export type CoworkSessionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'error';
export type CoworkMessageType =
  | 'user'
  | 'assistant'
  | 'tool_use'
  | 'tool_result'
  | 'system';
export type CoworkExecutionMode = 'auto' | 'local' | 'sandbox';

export type AgentSource = 'custom' | 'preset';

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  identity: string;
  model: string;
  agentEngine: CoworkAgentEngine;
  icon: string;
  skillIds: string[];
  enabled: boolean;
  isDefault: boolean;
  source: AgentSource;
  presetId: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentRequest {
  id?: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  identity?: string;
  model?: string;
  agentEngine?: CoworkAgentEngine;
  icon?: string;
  skillIds?: string[];
  source?: AgentSource;
  presetId?: string;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  systemPrompt?: string;
  identity?: string;
  model?: string;
  agentEngine?: CoworkAgentEngine;
  icon?: string;
  skillIds?: string[];
  enabled?: boolean;
}

export interface AgentTeamMember {
  agentId: string;
  role: string;
  order: number;
}

export interface AgentTeam {
  id: string;
  name: string;
  description: string;
  icon: string;
  leadAgentId: string;
  members: AgentTeamMember[];
  defaultWorkflow: AgentTeamWorkflowType;
  skillIds: string[];
  enabled: boolean;
  source: AgentSource;
  presetId: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentTeamRequest {
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  leadAgentId?: string;
  members?: AgentTeamMember[];
  defaultWorkflow?: AgentTeamWorkflowType;
  skillIds?: string[];
  source?: AgentSource;
  presetId?: string;
}

export interface UpdateAgentTeamRequest {
  name?: string;
  description?: string;
  icon?: string;
  leadAgentId?: string;
  members?: AgentTeamMember[];
  defaultWorkflow?: AgentTeamWorkflowType;
  skillIds?: string[];
  enabled?: boolean;
}

export interface CoworkMessageMetadata {
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  toolUseId?: string | null;
  error?: string;
  isError?: boolean;
  isStreaming?: boolean;
  isFinal?: boolean;
  skillIds?: string[];
  generatedImages?: Array<{
    path: string;
    name?: string;
    mimeType?: string;
    source?: string;
  }>;
  [key: string]: unknown;
}

export interface CoworkMessage {
  id: string;
  type: CoworkMessageType;
  content: string;
  timestamp: number;
  metadata?: CoworkMessageMetadata;
}

export interface CoworkSession {
  id: string;
  title: string;
  claudeSessionId: string | null;
  status: CoworkSessionStatus;
  pinned: boolean;
  cwd: string;
  systemPrompt: string;
  executionMode: CoworkExecutionMode;
  activeSkillIds: string[];
  agentId: string;
  sessionKind: CoworkSessionKindType;
  parentSessionId: string | null;
  teamId: string | null;
  runtimeSnapshot: CoworkSessionRuntimeSnapshot | null;
  messages: CoworkMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface CoworkSessionSummary {
  id: string;
  title: string;
  status: CoworkSessionStatus;
  pinned: boolean;
  agentId: string;
  sessionKind: CoworkSessionKindType;
  parentSessionId: string | null;
  teamId: string | null;
  runtimeSnapshot: CoworkSessionRuntimeSnapshot | null;
  createdAt: number;
  updatedAt: number;
}

export interface CoworkImportedSessionInput {
  id: string;
  title: string;
  claudeSessionId: string | null;
  status: CoworkSessionStatus;
  cwd: string;
  systemPrompt: string;
  executionMode: CoworkExecutionMode;
  activeSkillIds: string[];
  agentId: string;
  sessionKind?: CoworkSessionKindType;
  parentSessionId?: string | null;
  teamId?: string | null;
  runtimeSnapshot?: CoworkSessionRuntimeSnapshot | null;
  createdAt: number;
  updatedAt: number;
}

export interface CoworkImportedMessageInput {
  id: string;
  type: CoworkMessageType;
  content: string;
  metadata?: CoworkMessageMetadata;
  timestamp: number;
}

export type CoworkUserMemoryStatus = 'created' | 'stale' | 'deleted';

export interface CoworkUserMemory {
  id: string;
  text: string;
  confidence: number;
  isExplicit: boolean;
  status: CoworkUserMemoryStatus;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export interface CoworkUserMemorySource {
  id: string;
  memoryId: string;
  sessionId: string | null;
  messageId: string | null;
  role: 'user' | 'assistant' | 'tool' | 'system';
  isActive: boolean;
  createdAt: number;
}

export interface CoworkUserMemorySourceInput {
  sessionId?: string;
  messageId?: string;
  role?: 'user' | 'assistant' | 'tool' | 'system';
}

export interface CoworkUserMemoryStats {
  total: number;
  created: number;
  stale: number;
  deleted: number;
  explicit: number;
  implicit: number;
}

export interface CoworkConversationSearchRecord {
  sessionId: string;
  title: string;
  updatedAt: number;
  url: string;
  human: string;
  assistant: string;
}

export interface CoworkConfig {
  workingDirectory: string;
  systemPrompt: string;
  executionMode: CoworkExecutionMode;
  agentEngine: CoworkAgentEngine;
  openclawConfigSource: ExternalAgentConfigSourceType;
  claudeCodeConfigSource: ExternalAgentConfigSourceType;
  claudeCodePermissionMode: ClaudeCodePermissionModeType;
  codexConfigSource: ExternalAgentConfigSourceType;
  hermesConfigSource: ExternalAgentConfigSourceType;
  opencodeConfigSource: ExternalAgentConfigSourceType;
  opencodePermissionMode: OpenCodePermissionModeType;
  deepseekTuiConfigSource: ExternalAgentConfigSourceType;
  deepseekTuiPermissionMode: DeepSeekTuiPermissionModeType;
  memoryEnabled: boolean;
  memoryImplicitUpdateEnabled: boolean;
  memoryLlmJudgeEnabled: boolean;
  memoryGuardLevel: CoworkMemoryGuardLevel;
  memoryUserMemoriesMaxItems: number;
}

export type CoworkConfigUpdate = Partial<
  Pick<
    CoworkConfig,
    | 'workingDirectory'
    | 'executionMode'
    | 'agentEngine'
    | 'openclawConfigSource'
    | 'claudeCodeConfigSource'
    | 'claudeCodePermissionMode'
    | 'codexConfigSource'
    | 'hermesConfigSource'
    | 'opencodeConfigSource'
    | 'opencodePermissionMode'
    | 'deepseekTuiConfigSource'
    | 'deepseekTuiPermissionMode'
    | 'memoryEnabled'
    | 'memoryImplicitUpdateEnabled'
    | 'memoryLlmJudgeEnabled'
    | 'memoryGuardLevel'
    | 'memoryUserMemoriesMaxItems'
  >
>;

export interface ApplyTurnMemoryUpdatesOptions {
  sessionId: string;
  userText: string;
  assistantText: string;
  implicitEnabled: boolean;
  memoryLlmJudgeEnabled: boolean;
  guardLevel: CoworkMemoryGuardLevel;
  userMessageId?: string;
  assistantMessageId?: string;
}

export interface ApplyTurnMemoryUpdatesResult {
  totalChanges: number;
  created: number;
  updated: number;
  deleted: number;
  judgeRejected: number;
  llmReviewed: number;
  skipped: number;
}
