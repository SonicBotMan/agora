/**
 * PermissionManager — permission request approval pipeline.
 *
 * Manages permission request lifecycle: submission, approval, and denial.
 * Extends EventEmitter to notify listeners of permission state changes.
 */

import { EventEmitter } from 'events';

import type { PermissionRequest } from '../main/libs/agentEngine/types';

/**
 * Events emitted by PermissionManager.
 */
export interface PermissionManagerEvents {
  requestCreated: (request: PermissionRequest) => void;
  requestApproved: (requestId: string) => void;
  requestDenied: (requestId: string) => void;
}

/**
 * PermissionManager — handles permission request lifecycle.
 */
export class PermissionManager extends EventEmitter {
  private readonly pendingRequests: Map<string, PermissionRequest> = new Map();

  /**
   * Submits a new permission request for approval.
   */
  requestPermission(request: PermissionRequest): void {
    this.pendingRequests.set(request.requestId, request);
    this.emit('requestCreated', request);
  }

  /**
   * Approves a pending permission request. Returns true if the request existed.
   */
  approvePermission(requestId: string): boolean {
    if (!this.pendingRequests.has(requestId)) {
      return false;
    }
    this.pendingRequests.delete(requestId);
    this.emit('requestApproved', requestId);
    return true;
  }

  /**
   * Denies a pending permission request. Returns true if the request existed.
   */
  denyPermission(requestId: string): boolean {
    if (!this.pendingRequests.has(requestId)) {
      return false;
    }
    this.pendingRequests.delete(requestId);
    this.emit('requestDenied', requestId);
    return true;
  }

  /**
   * Returns all currently pending permission requests.
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }
}
