/**
 * PermissionManager — shared permission lifecycle coordinator.
 *
 * Tracks pending runtime permission requests, supports resolution/dismissal,
 * and emits lifecycle events that UI forwarders can observe.
 */

import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'events';

import type { PermissionRequest } from '../main/libs/agentEngine/types';

export type PermissionResolutionAction = 'approve' | 'deny';

export type PermissionDismissReason =
  | 'external'
  | 'session-complete'
  | 'session-error'
  | 'session-stopped';

export interface PendingPermissionRecord {
  requestId: string;
  sessionId: string;
  request: PermissionRequest;
  createdAt: number;
}

export interface PermissionResolvedEvent {
  permission: PendingPermissionRecord;
  action: PermissionResolutionAction;
  result: PermissionResult;
}

export interface PermissionDismissedEvent {
  permission: PendingPermissionRecord;
  reason: PermissionDismissReason;
}

export interface PermissionManagerEvents {
  requestCreated: (permission: PendingPermissionRecord) => void;
  requestResolved: (event: PermissionResolvedEvent) => void;
  requestDismissed: (event: PermissionDismissedEvent) => void;
}

export class PermissionManager extends EventEmitter {
  private readonly pendingRequests = new Map<string, PendingPermissionRecord>();

  requestPermission(request: PermissionRequest): PendingPermissionRecord;
  requestPermission(
    sessionId: string,
    request: PermissionRequest,
  ): PendingPermissionRecord;
  requestPermission(
    sessionIdOrRequest: string | PermissionRequest,
    maybeRequest?: PermissionRequest,
  ): PendingPermissionRecord {
    const sessionId =
      typeof sessionIdOrRequest === 'string'
        ? sessionIdOrRequest
        : '__unknown__';
    const request =
      typeof sessionIdOrRequest === 'string'
        ? maybeRequest
        : sessionIdOrRequest;

    if (!request) {
      throw new Error('Permission request payload is required.');
    }

    const existing = this.pendingRequests.get(request.requestId);
    if (existing) {
      return existing;
    }

    const permission: PendingPermissionRecord = {
      requestId: request.requestId,
      sessionId,
      request,
      createdAt: Date.now(),
    };
    this.pendingRequests.set(request.requestId, permission);
    this.emit('requestCreated', permission);
    return permission;
  }

  approvePermission(requestId: string, result: PermissionResult): boolean {
    return this.resolvePermission(requestId, 'approve', result);
  }

  denyPermission(requestId: string, result: PermissionResult): boolean {
    return this.resolvePermission(requestId, 'deny', result);
  }

  dismissPermission(
    requestId: string,
    reason: PermissionDismissReason = 'external',
  ): boolean {
    const permission = this.pendingRequests.get(requestId);
    if (!permission) {
      return false;
    }

    this.pendingRequests.delete(requestId);
    this.emit('requestDismissed', {
      permission,
      reason,
    } satisfies PermissionDismissedEvent);
    return true;
  }

  dismissSessionPermissions(
    sessionId: string,
    reason: PermissionDismissReason,
  ): number {
    const requestIds = Array.from(this.pendingRequests.values())
      .filter((permission) => permission.sessionId === sessionId)
      .map((permission) => permission.requestId);

    requestIds.forEach((requestId) => {
      this.dismissPermission(requestId, reason);
    });

    return requestIds.length;
  }

  getPendingPermission(requestId: string): PendingPermissionRecord | null {
    return this.pendingRequests.get(requestId) ?? null;
  }

  getPendingRequests(sessionId?: string): PendingPermissionRecord[] {
    const pending = Array.from(this.pendingRequests.values());
    if (!sessionId) {
      return pending;
    }
    return pending.filter((permission) => permission.sessionId === sessionId);
  }

  private resolvePermission(
    requestId: string,
    action: PermissionResolutionAction,
    result: PermissionResult,
  ): boolean {
    const permission = this.pendingRequests.get(requestId);
    if (!permission) {
      return false;
    }

    this.pendingRequests.delete(requestId);
    this.emit('requestResolved', {
      permission,
      action,
      result,
    } satisfies PermissionResolvedEvent);
    return true;
  }
}
