/**
 * Action interfaces for triggering actions based on hot topics.
 */

import type { TopicAction, TopicActionResult } from './types';

// ── Research Action ──────────────────────────────────────────────────────────

export interface ResearchActionOptions {
  topicId: string;
  depth?: 'quick' | 'deep';
  sources?: string[];
}

// ── Writing Action ───────────────────────────────────────────────────────────

export interface WritingActionOptions {
  topicId: string;
  style?: 'news' | 'analysis' | 'summary' | 'thread';
  tone?: 'neutral' | 'enthusiastic' | 'critical';
  wordLimit?: number;
}

// ── Push Action ──────────────────────────────────────────────────────────────

export interface PushActionOptions {
  topicId: string;
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
    return {
      topicId: options.topicId,
      action: 'writing' as TopicAction,
      success: true,
      result: `Writing task queued (style: ${options.style ?? 'summary'}, tone: ${options.tone ?? 'neutral'})`,
      timestamp: new Date().toISOString(),
    };
  }

  async push(options: PushActionOptions): Promise<TopicActionResult> {
    return {
      topicId: options.topicId,
      action: 'push' as TopicAction,
      success: true,
      result: `Pushed to channels: ${options.channels.join(', ')} in format ${options.format ?? 'text'}`,
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
