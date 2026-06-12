/**
 * Action interfaces for triggering actions based on hot topics.
 */

import { type Platform,PlatformRegistry } from '../../shared/platform';
import type { TopicAction, TopicActionResult, TopicItem } from './types';

type NotificationTargetRecord = {
  conversationId?: string;
};

type NotificationTargetStore = {
  getNotificationTarget: (platform: Platform) => unknown;
};

export interface TopicActionIMGateway {
  getIMStore: () => NotificationTargetStore;
  getActiveFeishuEngineKey?: () => string;
  isConnected?: (platform: Platform) => boolean;
  sendConversationReply: (
    platform: Platform,
    conversationId: string,
    text: string,
  ) => Promise<boolean>;
}

export interface TopicWritingDraft {
  title: string;
  style: NonNullable<WritingActionOptions['style']>;
  format: 'markdown' | 'text';
  content: string;
  estimatedWords: number;
}

export interface DefaultActionDispatcherOptions {
  getIMGatewayManager?: () => TopicActionIMGateway | null;
}

// ── Research Action ──────────────────────────────────────────────────────────

export interface ResearchActionOptions {
  topicId: string;
  depth?: 'quick' | 'deep';
  sources?: string[];
}

// ── Writing Action ───────────────────────────────────────────────────────────

export interface WritingActionOptions {
  topicId: string;
  topic: TopicItem;
  style?: 'news' | 'analysis' | 'summary' | 'thread';
  tone?: 'neutral' | 'enthusiastic' | 'critical';
  wordLimit?: number;
}

// ── Push Action ──────────────────────────────────────────────────────────────

export interface PushActionOptions {
  topicId: string;
  topic: TopicItem;
  channels: string[];
  format?: 'text' | 'card' | 'link';
}

// ── Save Action ──────────────────────────────────────────────────────────────

export interface SaveActionOptions {
  topicId: string;
  targetCollection?: string;
  tags?: string[];
}

// ── Action Dispatcher ─────────────────────────────────────────────────────────

export interface ActionDispatcher {
  research(options: ResearchActionOptions): Promise<TopicActionResult>;
  writing(options: WritingActionOptions): Promise<TopicActionResult>;
  push(options: PushActionOptions): Promise<TopicActionResult>;
  save(options: SaveActionOptions): Promise<TopicActionResult>;
}

// ── Default Implementation ────────────────────────────────────────────────────

export class DefaultActionDispatcher implements ActionDispatcher {
  private readonly getIMGatewayManager?: () => TopicActionIMGateway | null;

  constructor(options: DefaultActionDispatcherOptions = {}) {
    this.getIMGatewayManager = options.getIMGatewayManager;
  }

  async research(options: ResearchActionOptions): Promise<TopicActionResult> {
    return {
      topicId: options.topicId,
      action: 'research' as TopicAction,
      success: true,
      result: `Research (${options.depth ?? 'quick'}) queued for topic ${options.topicId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async writing(options: WritingActionOptions): Promise<TopicActionResult> {
    const draft = buildWritingDraft(options);

    return {
      topicId: options.topicId,
      action: 'writing' as TopicAction,
      success: true,
      result: `Generated a ${draft.style} draft for "${options.topic.title}"`,
      payload: {
        draft: draft.content,
        draftTitle: draft.title,
        format: draft.format,
        estimatedWords: draft.estimatedWords,
        style: draft.style,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async push(options: PushActionOptions): Promise<TopicActionResult> {
    const manager = this.getIMGatewayManager?.() ?? null;
    if (!manager) {
      return {
        topicId: options.topicId,
        action: 'push' as TopicAction,
        success: false,
        error: 'IM gateway manager is not available for hot topic delivery.',
        timestamp: new Date().toISOString(),
      };
    }

    const targets = options.channels
      .map((channel) => parsePushTarget(channel))
      .filter((target): target is ParsedPushTarget => Boolean(target));

    if (targets.length === 0) {
      return {
        topicId: options.topicId,
        action: 'push' as TopicAction,
        success: false,
        error: 'No usable IM delivery targets were provided.',
        timestamp: new Date().toISOString(),
      };
    }

    const message = buildPushMessage(options.topic, options.format);
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
      if (activeFeishuEngineKey
        && activeFeishuEngineKey !== 'claude-code'
        && activeFeishuEngineKey !== 'codex') {
        failed.push(
          `${target.raw}: current Feishu runtime is "${activeFeishuEngineKey}", which does not support direct hot topic delivery yet.`,
        );
        continue;
      }

      if (manager.isConnected && !manager.isConnected(target.platform)) {
        failed.push(
          `${target.raw}: Feishu gateway is not connected.`,
        );
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

    const resultSummary = buildPushResultSummary(
      options.topic.title,
      delivered,
      failed,
    );

    if (delivered.length === 0) {
      return {
        topicId: options.topicId,
        action: 'push' as TopicAction,
        success: false,
        error: resultSummary,
        payload: {
          delivered,
          failed,
          message,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      topicId: options.topicId,
      action: 'push' as TopicAction,
      success: true,
      result: resultSummary,
      payload: {
        delivered,
        failed,
        message,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async save(options: SaveActionOptions): Promise<TopicActionResult> {
    return {
      topicId: options.topicId,
      action: 'save' as TopicAction,
      success: true,
      result: `Saved to collection: ${options.targetCollection ?? 'default'}${options.tags ? ` with tags: ${options.tags.join(', ')}` : ''}`,
      timestamp: new Date().toISOString(),
    };
  }
}

interface ParsedPushTarget {
  raw: string;
  platform: Platform;
  conversationId?: string;
}

function buildWritingDraft(options: WritingActionOptions): TopicWritingDraft {
  const style = options.style ?? 'summary';
  const tone = options.tone ?? 'neutral';
  const title = formatDraftTitle(options.topic.title, style);
  const body = formatDraftBody(options.topic, style, tone);
  const content = applyWordLimit(body, options.wordLimit);

  return {
    title,
    style,
    format: style === 'thread' ? 'text' : 'markdown',
    content,
    estimatedWords: countWords(content),
  };
}

function formatDraftTitle(
  topicTitle: string,
  style: NonNullable<WritingActionOptions['style']>,
): string {
  if (style === 'thread') {
    return `${topicTitle} Thread Draft`;
  }
  if (style === 'news') {
    return `${topicTitle} News Draft`;
  }
  if (style === 'analysis') {
    return `${topicTitle} Analysis Draft`;
  }
  return `${topicTitle} Summary Draft`;
}

function formatDraftBody(
  topic: TopicItem,
  style: NonNullable<WritingActionOptions['style']>,
  tone: NonNullable<WritingActionOptions['tone']>,
): string {
  const perspective = describeTone(tone);
  const tagLine = topic.tags.length > 0 ? topic.tags.join(', ') : 'n/a';
  const sourceLine = `[${topic.source}](${topic.url})`;

  if (style === 'thread') {
    return [
      `1/ ${topic.title}`,
      `2/ ${topic.summary}`,
      `3/ Why it matters: ${describeWhyItMatters(topic, tone)}`,
      `4/ Key signals: category=${topic.category}, score=${formatScore(topic.score)}, tags=${tagLine}.`,
      `5/ Suggested angle: ${perspective}`,
      `6/ Source: ${topic.url}`,
    ].join('\n');
  }

  if (style === 'news') {
    return [
      `# ${topic.title}`,
      '',
      `${topic.summary}`,
      '',
      '## Key Facts',
      `- Source: ${topic.source}`,
      `- Category: ${topic.category}`,
      `- Score: ${formatScore(topic.score)}`,
      `- Tags: ${tagLine}`,
      '',
      '## Why It Matters',
      describeWhyItMatters(topic, tone),
      '',
      '## What To Watch Next',
      describeFollowUp(topic),
      '',
      `Source link: ${sourceLine}`,
    ].join('\n');
  }

  if (style === 'analysis') {
    return [
      `# ${topic.title}`,
      '',
      '## Executive Summary',
      topic.summary,
      '',
      '## Why This Topic Deserves Attention',
      describeWhyItMatters(topic, tone),
      '',
      '## Signals Behind The Score',
      `The topic currently sits at ${formatScore(topic.score)} points, sourced from ${topic.source}, with category ${topic.category}.`,
      '',
      '## Recommended Team Response',
      `Use this topic as a ${perspective.toLowerCase()} anchor for follow-up research, product positioning, or market commentary.`,
      '',
      '## Source',
      `- ${sourceLine}`,
      `- Discovered at: ${topic.discoveredAt}`,
    ].join('\n');
  }

  return [
    `# ${topic.title}`,
    '',
    topic.summary,
    '',
    '## Why It Matters',
    describeWhyItMatters(topic, tone),
    '',
    '## Quick Takeaways',
    `- Source: ${topic.source}`,
    `- Category: ${topic.category}`,
    `- Tags: ${tagLine}`,
    `- Follow-up: ${describeFollowUp(topic)}`,
    '',
    `Source link: ${sourceLine}`,
  ].join('\n');
}

function describeTone(
  tone: NonNullable<WritingActionOptions['tone']>,
): string {
  if (tone === 'enthusiastic') {
    return 'high-energy, optimistic coverage that emphasizes momentum and opportunity';
  }
  if (tone === 'critical') {
    return 'measured, skeptical coverage that highlights risk, gaps, and unanswered questions';
  }
  return 'balanced coverage that focuses on concrete implications over hype';
}

function describeWhyItMatters(
  topic: TopicItem,
  tone: NonNullable<WritingActionOptions['tone']>,
): string {
  const base = `This ${topic.category} signal matters because it can influence what the team researches, ships, or communicates next.`;
  if (tone === 'enthusiastic') {
    return `${base} The current momentum suggests a timely window to turn the topic into a visible output.`;
  }
  if (tone === 'critical') {
    return `${base} The priority now is validating whether the signal is durable or just short-lived noise.`;
  }
  return `${base} The next step is to separate immediate relevance from background chatter.`;
}

function describeFollowUp(topic: TopicItem): string {
  if (topic.tags.length > 0) {
    return `Track follow-up signals around ${topic.tags.slice(0, 3).join(', ')} and compare with the original source coverage.`;
  }
  return `Monitor whether ${topic.source} produces additional evidence or competing interpretations.`;
}

function buildPushMessage(
  topic: TopicItem,
  format: NonNullable<PushActionOptions['format']> | undefined,
): string {
  const normalizedFormat = format ?? 'text';
  if (normalizedFormat === 'link') {
    return `${topic.title}\n${topic.url}`;
  }

  const lines = [
    topic.title,
    topic.summary,
    `Source: ${topic.source}`,
    `Category: ${topic.category}`,
    `Score: ${formatScore(topic.score)}`,
    `Link: ${topic.url}`,
  ];

  if (topic.tags.length > 0) {
    lines.push(`Tags: ${topic.tags.join(', ')}`);
  }

  return lines.join('\n');
}

function buildPushResultSummary(
  topicTitle: string,
  delivered: string[],
  failed: string[],
): string {
  const lines: string[] = [];

  if (delivered.length > 0) {
    lines.push(`Delivered topic "${topicTitle}" to ${delivered.join(', ')}`);
  }

  if (failed.length > 0) {
    lines.push('Failures:');
    lines.push(...failed.map((entry) => `- ${entry}`));
  }

  return lines.join('\n');
}

function applyWordLimit(content: string, wordLimit?: number): string {
  if (!wordLimit || wordLimit <= 0) {
    return content;
  }

  const words = content.split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) {
    return content;
  }

  return `${words.slice(0, wordLimit).join(' ')}...`;
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function formatScore(score: number): number {
  return Math.round(score);
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

  if (
    PlatformRegistry.platforms.includes(normalized as Platform)
  ) {
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
