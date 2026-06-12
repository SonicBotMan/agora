/**
 * Research session manager.
 * Handles creation, retrieval, listing, and cancellation of research sessions.
 */

import { EventEmitter } from 'events';

import { type Platform,PlatformRegistry } from '../../shared/platform';
import { ResearchIngestor } from '../knowledge-base/ResearchIngestor';
import { ReportGenerator } from './ReportGenerator';
import { ResearchEngine } from './ResearchEngine';
import type { ResearchQuery, ResearchResult } from './types';

export interface ResearchSessionRecord {
  id: string;
  query: ResearchQuery;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  result: ResearchResult | null;
  report: string | null;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface ResearchSessionOptions {
  engine?: Pick<ResearchEngine, 'research'>;
  reportGenerator?: ReportGenerator;
  researchIngestor?: ResearchIngestor;
  getIMGatewayManager?: () => ResearchSessionIMGateway | null;
}

type NotificationTargetRecord = {
  conversationId?: string;
};

type NotificationTargetStore = {
  getNotificationTarget: (platform: Platform) => unknown;
};

export interface ResearchSessionIMGateway {
  getIMStore: () => NotificationTargetStore;
  getActiveFeishuEngineKey?: () => string;
  isConnected?: (platform: Platform) => boolean;
  sendConversationReply: (
    platform: Platform,
    conversationId: string,
    text: string,
  ) => Promise<boolean>;
}

export interface ResearchDeliveryResult {
  sessionId: string;
  success: boolean;
  result?: string;
  error?: string;
  payload?: unknown;
  timestamp: string;
}

export type ResearchSessionEventType =
  | 'session:created'
  | 'session:updated'
  | 'session:completed'
  | 'session:cancelled'
  | 'session:error';

export interface ResearchSessionEvent {
  type: ResearchSessionEventType;
  sessionId: string;
  timestamp: string;
  record: ResearchSessionRecord;
  payload?: unknown;
}

export class ResearchSession extends EventEmitter {
  private sessions: Map<string, ResearchSessionRecord> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private engine: Pick<ResearchEngine, 'research'>;
  private reportGenerator: ReportGenerator;
  private researchIngestor: ResearchIngestor;
  private getIMGatewayManager?: () => ResearchSessionIMGateway | null;

  constructor(options: ResearchSessionOptions = {}) {
    super();
    this.engine = options.engine ?? new ResearchEngine();
    this.reportGenerator = options.reportGenerator ?? new ReportGenerator();
    this.researchIngestor = options.researchIngestor ?? new ResearchIngestor();
    this.getIMGatewayManager = options.getIMGatewayManager;
  }

  /**
   * Create and start a new research session.
   */
  create(query: ResearchQuery): ResearchSessionRecord {
    const id = this.generateId();
    const now = new Date().toISOString();

    const record: ResearchSessionRecord = {
      id,
      query,
      status: 'running',
      result: null,
      report: null,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(id, record);
    this.emitSessionEvent('session:created', record);
    void this.startExecution(id, query);

    return record;
  }

  /**
   * Get a session record by ID.
   */
  get(id: string): ResearchSessionRecord | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all session records.
   */
  list(): ResearchSessionRecord[] {
    return Array.from(this.sessions.values()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  /**
   * Cancel an active research session.
   */
  cancel(id: string): boolean {
    const record = this.sessions.get(id);
    if (!record || record.status !== 'running') {
      return false;
    }

    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    record.status = 'cancelled';
    record.updatedAt = new Date().toISOString();
    this.emitSessionEvent('session:cancelled', record);
    return true;
  }

  getResult(id: string): ResearchResult | null {
    return this.sessions.get(id)?.result ?? null;
  }

  getReport(id: string): string | null {
    return this.sessions.get(id)?.report ?? null;
  }

  async pushToIM(
    id: string,
    channels: string[],
  ): Promise<ResearchDeliveryResult> {
    const record = this.sessions.get(id);
    if (!record) {
      return this.createDeliveryFailure(id, `Research session not found: ${id}`);
    }

    if (record.status !== 'completed' || !record.result) {
      return this.createDeliveryFailure(
        id,
        `Research session "${record.query.query}" is not ready for IM delivery yet.`,
      );
    }

    const manager = this.getIMGatewayManager?.() ?? null;
    if (!manager) {
      return this.createDeliveryFailure(
        id,
        'IM gateway manager is not available for research delivery.',
      );
    }

    const targets = channels
      .map((channel) => parsePushTarget(channel))
      .filter((target): target is ParsedPushTarget => Boolean(target));
    if (targets.length === 0) {
      return this.createDeliveryFailure(
        id,
        'No usable IM delivery targets were provided.',
      );
    }

    const message = buildResearchDeliveryMessage(record);
    const delivered: string[] = [];
    const failed: string[] = [];

    for (const target of targets) {
      if (target.platform !== 'feishu') {
        failed.push(
          `${target.raw}: only native Feishu outbound delivery is currently supported.`,
        );
        continue;
      }

      const activeFeishuEngineKey = manager.getActiveFeishuEngineKey?.();
      if (
        activeFeishuEngineKey
        && activeFeishuEngineKey !== 'claude-code'
        && activeFeishuEngineKey !== 'codex'
      ) {
        failed.push(
          `${target.raw}: current Feishu runtime is "${activeFeishuEngineKey}", which does not support direct research delivery yet.`,
        );
        continue;
      }

      if (manager.isConnected && !manager.isConnected(target.platform)) {
        failed.push(`${target.raw}: Feishu gateway is not connected.`);
        continue;
      }

      const conversationId = target.conversationId
        ?? readStoredConversationId(
          manager.getIMStore().getNotificationTarget(target.platform),
        );
      if (!conversationId) {
        failed.push(
          `${target.raw}: no Feishu conversation target is available. Use feishu:<conversationId> or send a message from the destination chat first.`,
        );
        continue;
      }

      const ok = await manager.sendConversationReply(
        target.platform,
        conversationId,
        message,
      );

      if (ok) {
        delivered.push(target.raw);
      } else {
        failed.push(
          `${target.raw}: delivery failed. Verify the Feishu gateway is connected and the conversation target is valid.`,
        );
      }
    }

    const summary = buildDeliverySummary(record.query.query, delivered, failed);
    if (delivered.length === 0) {
      return {
        sessionId: id,
        success: false,
        error: summary,
        payload: {
          delivered,
          failed,
          message,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      sessionId: id,
      success: true,
      result: summary,
      payload: {
        delivered,
        failed,
        message,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private generateId(): string {
    return `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async startExecution(id: string, query: ResearchQuery): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(id, controller);

    try {
      // Iterate through the async generator to drive the research
      const generator = this.engine.research(query);
      let result: ResearchResult | null = null;

      for await (const event of generator) {
        if (controller.signal.aborted) {
          return;
        }

        const record = this.sessions.get(id);
        if (!record) {
          return;
        }

        record.updatedAt = new Date().toISOString();

        if (event.type === 'saved') {
          result = event.result;
          record.result = event.result;
        }

        this.emitSessionEvent('session:updated', record, event);
      }

      const record = this.sessions.get(id);
      if (record) {
        if (controller.signal.aborted) {
          return;
        }

        if (!result) {
          record.status = 'error';
          record.error = 'Research completed without producing a result';
          record.updatedAt = new Date().toISOString();
          this.emitSessionEvent('session:error', record, {
            error: record.error,
          });
          return;
        }

        const ingestion = await this.researchIngestor.ingest(result);
        if (controller.signal.aborted) {
          return;
        }

        const completedResult: ResearchResult = {
          ...result,
          savedToKnowledgeBase:
            this.researchIngestor.hasKnowledgeStore() && ingestion.succeeded > 0,
        };
        const report = this.reportGenerator.generate(completedResult);

        record.status = 'completed';
        record.result = completedResult;
        record.report = report;
        record.updatedAt = new Date().toISOString();
        this.emitSessionEvent('session:completed', record, {
          ingestion,
          report,
        });
      }
    } catch (err) {
      const record = this.sessions.get(id);
      if (record && !controller.signal.aborted) {
        record.status = 'error';
        record.error = err instanceof Error ? err.message : String(err);
        record.updatedAt = new Date().toISOString();
        this.emitSessionEvent('session:error', record, {
          error: record.error,
        });
      }
    } finally {
      this.abortControllers.delete(id);
    }
  }

  private emitSessionEvent(
    type: ResearchSessionEventType,
    record: ResearchSessionRecord,
    payload?: unknown,
  ): void {
    const event: ResearchSessionEvent = {
      type,
      sessionId: record.id,
      timestamp: new Date().toISOString(),
      record: { ...record },
      payload,
    };

    (this.emit as (event: string, data: ResearchSessionEvent) => void)(
      'research:event',
      event,
    );
  }

  private createDeliveryFailure(
    sessionId: string,
    error: string,
  ): ResearchDeliveryResult {
    return {
      sessionId,
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };
  }
}

interface ParsedPushTarget {
  raw: string;
  platform: Platform;
  conversationId?: string;
}

function buildResearchDeliveryMessage(record: ResearchSessionRecord): string {
  const result = record.result!;
  const lines = [
    `Deep Research: ${result.query}`,
    `Confidence: ${Math.round(result.confidence * 100)}%`,
    `Rounds: ${result.rounds.length}`,
    `Sources: ${result.sources.length}`,
    '',
    'Summary:',
    result.synthesis,
  ];

  if (result.findings.length > 0) {
    lines.push('', 'Top findings:');
    for (const [index, finding] of result.findings.slice(0, 3).entries()) {
      lines.push(
        `${index + 1}. ${finding.title} - ${truncateText(finding.snippet, 180)}`,
      );
    }
  }

  if (result.sources.length > 0) {
    lines.push('', 'Sources:');
    for (const source of result.sources.slice(0, 3)) {
      lines.push(`- ${source.title}: ${source.url}`);
    }
  }

  return truncateText(lines.join('\n'), 3500);
}

function buildDeliverySummary(
  query: string,
  delivered: string[],
  failed: string[],
): string {
  const lines: string[] = [];

  if (delivered.length > 0) {
    lines.push(
      `Delivered research "${query}" to ${delivered.join(', ')}`,
    );
  }

  if (failed.length > 0) {
    lines.push('Failures:');
    lines.push(...failed.map((entry) => `- ${entry}`));
  }

  return lines.join('\n');
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function parsePushTarget(raw: string): ParsedPushTarget | null {
  const normalized = raw.trim();
  if (!normalized) {
    return null;
  }

  const directPlatform = resolvePlatform(normalized);
  if (directPlatform) {
    return {
      raw: normalized,
      platform: directPlatform,
    };
  }

  const colonIndex = normalized.indexOf(':');
  if (colonIndex <= 0) {
    return null;
  }

  const platformId = resolvePlatform(normalized.slice(0, colonIndex));
  const conversationId = normalized.slice(colonIndex + 1).trim();
  if (!platformId || !conversationId) {
    return null;
  }

  return {
    raw: normalized,
    platform: platformId,
    conversationId,
  };
}

function resolvePlatform(value: string): Platform | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (PlatformRegistry.platforms.includes(normalized as Platform)) {
    return normalized as Platform;
  }

  return PlatformRegistry.platformOfChannel(normalized) ?? null;
}

function readStoredConversationId(target: unknown): string | null {
  if (typeof target === 'string') {
    return target.trim() || null;
  }

  if (target && typeof target === 'object') {
    const record = target as NotificationTargetRecord;
    if (typeof record.conversationId === 'string') {
      const normalized = record.conversationId.trim();
      return normalized || null;
    }
  }

  return null;
}
