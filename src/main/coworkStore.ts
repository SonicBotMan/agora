import Database from 'better-sqlite3';

import type { CoworkSessionKind as CoworkSessionKindType } from '../shared/cowork/constants';
import type { CoworkSessionRuntimeSnapshot } from '../shared/cowork/runtimeSnapshot';
import { AgentStore } from './core/agentStore';
import { ConfigManager } from './core/configManager';
import { ConversationQueryStore } from './core/conversationQueryStore';
import { MessageStore } from './core/messageStore';
import { SessionManager } from './core/sessionManager';
import { UserMemoryStore } from './core/userMemoryStore';
import type {
  Agent,
  AgentTeam,
  ApplyTurnMemoryUpdatesOptions,
  ApplyTurnMemoryUpdatesResult,
  CoworkConfig,
  CoworkConfigUpdate,
  CoworkConversationSearchRecord,
  CoworkExecutionMode,
  CoworkImportedMessageInput,
  CoworkImportedSessionInput,
  CoworkMessage,
  CoworkMessageMetadata,
  CoworkSession,
  CoworkSessionSummary,
  CoworkUserMemory,
  CoworkUserMemorySourceInput,
  CoworkUserMemoryStats,
  CoworkUserMemoryStatus,
  CreateAgentRequest,
  CreateAgentTeamRequest,
  UpdateAgentRequest,
  UpdateAgentTeamRequest,
} from './coworkStoreTypes';

export * from './coworkStoreTypes';

export class CoworkStore {
  private agentStore: AgentStore;
  private conversationQueryStore: ConversationQueryStore;
  private configManager: ConfigManager;
  private messageStore: MessageStore;
  private sessionManager: SessionManager;
  private userMemoryStore: UserMemoryStore;

  constructor(db: Database.Database) {
    this.agentStore = new AgentStore(db);
    this.conversationQueryStore = new ConversationQueryStore(db);
    this.configManager = new ConfigManager(db);
    this.messageStore = new MessageStore(db);
    this.userMemoryStore = new UserMemoryStore(db);
    this.sessionManager = new SessionManager(db, {
      messageStore: this.messageStore,
      beforeDeleteSession: (sessionId) => {
        this.userMemoryStore.markMemorySourcesInactiveBySession(sessionId);
      },
      afterDeleteSessions: () => {
        this.userMemoryStore.markOrphanImplicitMemoriesStale();
      },
    });
  }

  createSession(
    title: string,
    cwd: string,
    systemPrompt: string = '',
    executionMode: CoworkExecutionMode = 'local',
    activeSkillIds: string[] = [],
    agentId: string = 'main',
    options: {
      sessionKind?: CoworkSessionKindType;
      parentSessionId?: string | null;
      teamId?: string | null;
      runtimeSnapshot?: CoworkSessionRuntimeSnapshot | null;
    } = {},
  ): CoworkSession {
    return this.sessionManager.createSession(
      title,
      cwd,
      systemPrompt,
      executionMode,
      activeSkillIds,
      agentId,
      options,
    );
  }

  getSession(id: string): CoworkSession | null {
    return this.sessionManager.getSession(id);
  }

  updateSession(
    id: string,
    updates: Partial<
      Pick<
        CoworkSession,
        'title' | 'claudeSessionId' | 'status' | 'cwd' | 'systemPrompt' | 'executionMode' | 'runtimeSnapshot'
      >
    >,
  ): void {
    this.sessionManager.updateSession(id, updates);
  }

  deleteSession(id: string): void {
    this.sessionManager.deleteSession(id);
  }

  deleteSessions(ids: string[]): void {
    this.sessionManager.deleteSessions(ids);
  }

  setSessionPinned(id: string, pinned: boolean): void {
    this.sessionManager.setSessionPinned(id, pinned);
  }

  listSessions(agentId?: string): CoworkSessionSummary[] {
    return this.sessionManager.listSessions(agentId);
  }

  resetRunningSessions(): number {
    return this.sessionManager.resetRunningSessions();
  }

  listRecentCwds(limit: number = 8): string[] {
    return this.sessionManager.listRecentCwds(limit);
  }

  addMessage(sessionId: string, message: Omit<CoworkMessage, 'id' | 'timestamp'>): CoworkMessage {
    return this.messageStore.addMessage(sessionId, message);
  }

  /**
   * Insert a message before an existing message (by shifting sequences).
   * Used for channel-originated sessions where user messages need to appear
   * before assistant messages that were created during streaming.
   */
  insertMessageBeforeId(
    sessionId: string,
    beforeMessageId: string,
    message: Omit<CoworkMessage, 'id' | 'timestamp'>,
  ): CoworkMessage {
    return this.messageStore.insertMessageBeforeId(
      sessionId,
      beforeMessageId,
      message,
    );
  }

  /**
   * Delete a message from a session.
   * Used by reconciliation to remove duplicate or spurious messages.
   */
  deleteMessage(sessionId: string, messageId: string): boolean {
    return this.messageStore.deleteMessage(sessionId, messageId);
  }

  /**
   * Replace all user/assistant messages in a session with the given list.
   * Tool messages (tool_use, tool_result, system) are preserved in their existing positions.
   * Used by history reconciliation to align local state with the authoritative gateway history.
   */
  replaceConversationMessages(
    sessionId: string,
    authoritative: Array<{ role: 'user' | 'assistant'; text: string }>,
  ): void {
    this.messageStore.replaceConversationMessages(sessionId, authoritative);
  }

  upsertImportedSession(input: CoworkImportedSessionInput): boolean {
    return this.sessionManager.upsertImportedSession(input);
  }

  replaceImportedSessionMessages(sessionId: string, messages: CoworkImportedMessageInput[]): boolean {
    return this.messageStore.replaceImportedSessionMessages(sessionId, messages);
  }

  updateMessage(
    sessionId: string,
    messageId: string,
    updates: { content?: string; metadata?: CoworkMessageMetadata },
  ): void {
    this.messageStore.updateMessage(sessionId, messageId, updates);
  }

  // Config operations
  getConfig(): CoworkConfig {
    return this.configManager.getConfig();
  }

  setConfig(config: CoworkConfigUpdate): void {
    this.configManager.setConfig(config);
  }

  getAppLanguage(): 'zh' | 'en' {
    return this.configManager.getAppLanguage();
  }

  listUserMemories(
    options: {
      query?: string;
      status?: CoworkUserMemoryStatus | 'all';
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    } = {},
  ): CoworkUserMemory[] {
    return this.userMemoryStore.listUserMemories(options);
  }

  createUserMemory(input: {
    text: string;
    confidence?: number;
    isExplicit?: boolean;
    source?: CoworkUserMemorySourceInput;
  }): CoworkUserMemory {
    return this.userMemoryStore.createUserMemory(input);
  }

  updateUserMemory(input: {
    id: string;
    text?: string;
    confidence?: number;
    status?: CoworkUserMemoryStatus;
    isExplicit?: boolean;
  }): CoworkUserMemory | null {
    return this.userMemoryStore.updateUserMemory(input);
  }

  deleteUserMemory(id: string): boolean {
    return this.userMemoryStore.deleteUserMemory(id);
  }

  getUserMemoryStats(): CoworkUserMemoryStats {
    return this.userMemoryStore.getUserMemoryStats();
  }

  autoDeleteNonPersonalMemories(): number {
    return this.userMemoryStore.autoDeleteNonPersonalMemories();
  }

  markMemorySourcesInactiveBySession(sessionId: string): void {
    this.userMemoryStore.markMemorySourcesInactiveBySession(sessionId);
  }

  markOrphanImplicitMemoriesStale(): void {
    this.userMemoryStore.markOrphanImplicitMemoriesStale();
  }

  async applyTurnMemoryUpdates(
    options: ApplyTurnMemoryUpdatesOptions,
  ): Promise<ApplyTurnMemoryUpdatesResult> {
    return this.userMemoryStore.applyTurnMemoryUpdates(options);
  }

  conversationSearch(options: {
    query: string;
    maxResults?: number;
    before?: string;
    after?: string;
  }): CoworkConversationSearchRecord[] {
    return this.conversationQueryStore.conversationSearch(options);
  }

  recentChats(options: {
    n?: number;
    sortOrder?: 'asc' | 'desc';
    before?: string;
    after?: string;
  }): CoworkConversationSearchRecord[] {
    return this.conversationQueryStore.recentChats(options);
  }

  // ========== Agent CRUD ==========

  listAgents(): Agent[] {
    return this.agentStore.listAgents();
  }

  getAgent(id: string): Agent | null {
    return this.agentStore.getAgent(id);
  }

  createAgent(request: CreateAgentRequest): Agent {
    return this.agentStore.createAgent(request);
  }

  updateAgent(id: string, updates: UpdateAgentRequest): Agent | null {
    return this.agentStore.updateAgent(id, updates);
  }

  deleteAgent(id: string): boolean {
    return this.agentStore.deleteAgent(id);
  }

  // ========== Agent Team CRUD ==========

  listAgentTeams(): AgentTeam[] {
    return this.agentStore.listAgentTeams();
  }

  getAgentTeam(id: string): AgentTeam | null {
    return this.agentStore.getAgentTeam(id);
  }

  createAgentTeam(request: CreateAgentTeamRequest): AgentTeam {
    return this.agentStore.createAgentTeam(request);
  }

  updateAgentTeam(id: string, updates: UpdateAgentTeamRequest): AgentTeam | null {
    return this.agentStore.updateAgentTeam(id, updates);
  }

  deleteAgentTeam(id: string): boolean {
    return this.agentStore.deleteAgentTeam(id);
  }
}
