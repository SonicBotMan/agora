import { EventEmitter } from 'events';
import type {
  CoworkRuntime,
  CoworkStartOptions,
  CoworkContinueOptions,
  PermissionRequest,
  CoworkRuntimeEvents,
} from '../../core/types';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';

/**
 * OpenCode CLI runtime adapter.
 * Skeleton implementation — all methods throw or log.
 */
export class OpenCodeAdapter extends EventEmitter implements CoworkRuntime {
  override on<U extends keyof CoworkRuntimeEvents>(
    event: U,
    listener: CoworkRuntimeEvents[U],
  ): this {
    return super.on(event, listener);
  }

  override off<U extends keyof CoworkRuntimeEvents>(
    event: U,
    listener: CoworkRuntimeEvents[U],
  ): this {
    return super.off(event, listener);
  }

  async startSession(
    _sessionId: string,
    _prompt: string,
    _options: CoworkStartOptions = {},
  ): Promise<void> {
    console.log('[OpenCodeAdapter] startSession called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  async continueSession(
    _sessionId: string,
    _prompt: string,
    _options: CoworkContinueOptions = {},
  ): Promise<void> {
    console.log('[OpenCodeAdapter] continueSession called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  stopSession(_sessionId: string): void {
    console.log('[OpenCodeAdapter] stopSession called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  stopAllSessions(): void {
    console.log('[OpenCodeAdapter] stopAllSessions called');
    throw new Error('Not implemented');
  }

  respondToPermission(_requestId: string, _result: PermissionResult): void {
    console.log('[OpenCodeAdapter] respondToPermission called', { requestId: _requestId });
    throw new Error('Not implemented');
  }

  isSessionActive(_sessionId: string): boolean {
    console.log('[OpenCodeAdapter] isSessionActive called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  getSessionConfirmationMode(_sessionId: string): 'modal' | 'text' | null {
    console.log('[OpenCodeAdapter] getSessionConfirmationMode called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  onSessionDeleted?(_sessionId: string): void {
    console.log('[OpenCodeAdapter] onSessionDeleted called', { sessionId: _sessionId });
  }
}
