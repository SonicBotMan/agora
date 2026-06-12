import Database from 'better-sqlite3';

import type {
  ApplyTurnMemoryUpdatesOptions,
  ApplyTurnMemoryUpdatesResult,
  CoworkUserMemory,
  CoworkUserMemorySourceInput,
  CoworkUserMemoryStats,
  CoworkUserMemoryStatus,
} from '../coworkStoreTypes';
import { extractTurnMemoryChanges } from '../libs/coworkMemoryExtractor';
import { judgeMemoryCandidate } from '../libs/coworkMemoryJudge';
import { UserMemoryRecordStore } from './userMemoryRecordStore';
import { normalizeMemoryMatchKey, scoreDeleteMatch } from './userMemoryTextUtils';

export class UserMemoryStore {
  private recordStore: UserMemoryRecordStore;

  constructor(db: Database.Database) {
    this.recordStore = new UserMemoryRecordStore(db);
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
    return this.recordStore.listUserMemories(options);
  }

  createUserMemory(input: {
    text: string;
    confidence?: number;
    isExplicit?: boolean;
    source?: CoworkUserMemorySourceInput;
  }): CoworkUserMemory {
    return this.recordStore.createUserMemory(input);
  }

  updateUserMemory(input: {
    id: string;
    text?: string;
    confidence?: number;
    status?: CoworkUserMemoryStatus;
    isExplicit?: boolean;
  }): CoworkUserMemory | null {
    return this.recordStore.updateUserMemory(input);
  }

  deleteUserMemory(id: string): boolean {
    return this.recordStore.deleteUserMemory(id);
  }

  getUserMemoryStats(): CoworkUserMemoryStats {
    return this.recordStore.getUserMemoryStats();
  }

  autoDeleteNonPersonalMemories(): number {
    return this.recordStore.autoDeleteNonPersonalMemories();
  }

  markMemorySourcesInactiveBySession(sessionId: string): void {
    this.recordStore.markMemorySourcesInactiveBySession(sessionId);
  }

  markOrphanImplicitMemoriesStale(): void {
    this.recordStore.markOrphanImplicitMemoriesStale();
  }

  async applyTurnMemoryUpdates(
    options: ApplyTurnMemoryUpdatesOptions,
  ): Promise<ApplyTurnMemoryUpdatesResult> {
    const result: ApplyTurnMemoryUpdatesResult = {
      totalChanges: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      judgeRejected: 0,
      llmReviewed: 0,
      skipped: 0,
    };

    const extracted = extractTurnMemoryChanges({
      userText: options.userText,
      assistantText: options.assistantText,
      guardLevel: options.guardLevel,
      maxImplicitAdds: options.implicitEnabled ? 2 : 0,
    });
    result.totalChanges = extracted.length;

    let deleteCandidates: CoworkUserMemory[] | null = null;

    for (const change of extracted) {
      if (change.action === 'add') {
        if (!options.implicitEnabled && !change.isExplicit) {
          result.skipped += 1;
          continue;
        }
        const judge = await judgeMemoryCandidate({
          text: change.text,
          isExplicit: change.isExplicit,
          guardLevel: options.guardLevel,
          llmEnabled: options.memoryLlmJudgeEnabled,
        });
        if (judge.source === 'llm') {
          result.llmReviewed += 1;
        }
        if (!judge.accepted) {
          result.judgeRejected += 1;
          result.skipped += 1;
          continue;
        }

        const write = this.recordStore.createOrReviveUserMemory({
          text: change.text,
          confidence: change.confidence,
          isExplicit: change.isExplicit,
          source: {
            role: 'user',
            sessionId: options.sessionId,
            messageId: options.userMessageId,
          },
        });

        if (!change.isExplicit && options.assistantMessageId) {
          this.recordStore.addMemorySource(write.memory.id, {
            role: 'assistant',
            sessionId: options.sessionId,
            messageId: options.assistantMessageId,
          });
        }

        if (write.created) result.created += 1;
        else if (write.updated) result.updated += 1;
        else result.skipped += 1;
        continue;
      }

      const key = normalizeMemoryMatchKey(change.text);
      if (!key) {
        result.skipped += 1;
        continue;
      }

      if (!deleteCandidates) {
        deleteCandidates = this.recordStore.listUserMemories({
          status: 'all',
          includeDeleted: false,
          limit: 100,
        });
      }

      let target: CoworkUserMemory | null = null;
      let bestScore = 0;
      for (const entry of deleteCandidates) {
        const currentKey = normalizeMemoryMatchKey(entry.text);
        if (!currentKey) continue;
        const score = scoreDeleteMatch(currentKey, key);
        if (score <= bestScore) continue;
        bestScore = score;
        target = entry;
      }

      if (!target) {
        result.skipped += 1;
        continue;
      }

      const deleted = this.recordStore.deleteUserMemory(target.id);
      if (deleted) result.deleted += 1;
      else result.skipped += 1;
    }

    this.recordStore.markOrphanImplicitMemoriesStale();
    return result;
  }
}
