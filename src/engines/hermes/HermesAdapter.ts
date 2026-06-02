import { EventEmitter } from 'events';
import type {
  CoworkRuntime,
  CoworkStartOptions,
  CoworkContinueOptions,
  CoworkRuntimeEvents,
} from '../../core/types';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';

/**
 * Hermes runtime adapter.
 * Skeleton implementation — all methods throw or log.
 */
export class HermesAdapter extends EventEmitter implements CoworkRuntime {
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
    console.log('[HermesAdapter] startSession called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  async continueSession(
    _sessionId: string,
    _prompt: string,
    _options: CoworkContinueOptions = {},
  ): Promise<void> {
    console.log('[HermesAdapter] continueSession called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  stopSession(_sessionId: string): void {
    console.log('[HermesAdapter] stopSession called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  stopAllSessions(): void {
    console.log('[HermesAdapter] stopAllSessions called');
    throw new Error('Not implemented');
  }

  respondToPermission(_requestId: string, _result: PermissionResult): void {
    console.log('[HermesAdapter] respondToPermission called', { requestId: _requestId });
    throw new Error('Not implemented');
  }

  isSessionActive(_sessionId: string): boolean {
    console.log('[HermesAdapter] isSessionActive called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  getSessionConfirmationMode(_sessionId: string): 'modal' | 'text' | null {
    console.log('[HermesAdapter] getSessionConfirmationMode called', { sessionId: _sessionId });
    throw new Error('Not implemented');
  }

  onSessionDeleted?(_sessionId: string): void {
    console.log('[HermesAdapter] onSessionDeleted called', { sessionId: _sessionId });
  }
}
