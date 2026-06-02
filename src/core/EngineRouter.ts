/**
 * EngineRouter — 6-engine session router.
 *
 * Routes sessions to the appropriate engine runtime based on the requested
 * agent engine type. Maintains a session-to-engine mapping and implements
 * the CoworkRuntime interface, delegating calls to the correct underlying runtime.
 */

import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'events';

import { CoworkAgentEngine, DefaultCoworkAgentEngine, isCoworkAgentEngine } from '../shared/cowork/constants';
import type { CoworkAgentEngine as CoworkAgentEngineType } from '../shared/cowork/constants';
import type { CoworkRuntime, CoworkRuntimeEvents, CoworkStartOptions, CoworkContinueOptions } from './CoworkRuntime';
import { ENGINE_SWITCHED_CODE } from '../main/libs/agentEngine/types';

/**
 * Dependencies required to construct an EngineRouter.
 */
export interface EngineRouterDeps {
  openclawRuntime: CoworkRuntime;
  hermesRuntime: CoworkRuntime;
  claudeCodeRuntime: CoworkRuntime;
  codexRuntime: CoworkRuntime;
  openCodeRuntime: CoworkRuntime;
  deepSeekTuiRuntime: CoworkRuntime;
}

/**
 * EngineRouter — routes CoworkRuntime calls to the correct engine runtime
 * based on session→engine mappings. Extends EventEmitter to re-emit
 * runtime events as unified events.
 */
export class EngineRouter extends EventEmitter implements CoworkRuntime {
  private readonly runtimeByEngine: Record<CoworkAgentEngineType, CoworkRuntime>;
  private readonly sessionEngine: Map<string, CoworkAgentEngineType> = new Map();
  private currentEngine: CoworkAgentEngineType;

  constructor(deps: EngineRouterDeps) {
    super();

    this.runtimeByEngine = {
      [CoworkAgentEngine.OpenClaw]: deps.openclawRuntime,
      [CoworkAgentEngine.Hermes]: deps.hermesRuntime,
      [CoworkAgentEngine.ClaudeCode]: deps.claudeCodeRuntime,
      [CoworkAgentEngine.Codex]: deps.codexRuntime,
      [CoworkAgentEngine.OpenCode]: deps.openCodeRuntime,
      [CoworkAgentEngine.DeepSeekTui]: deps.deepSeekTuiRuntime,
    };

    this.currentEngine = DefaultCoworkAgentEngine;

    this.bindRuntimeEvents(CoworkAgentEngine.OpenClaw, deps.openclawRuntime);
    this.bindRuntimeEvents(CoworkAgentEngine.Hermes, deps.hermesRuntime);
    this.bindRuntimeEvents(CoworkAgentEngine.ClaudeCode, deps.claudeCodeRuntime);
    this.bindRuntimeEvents(CoworkAgentEngine.Codex, deps.codexRuntime);
    this.bindRuntimeEvents(CoworkAgentEngine.OpenCode, deps.openCodeRuntime);
    this.bindRuntimeEvents(CoworkAgentEngine.DeepSeekTui, deps.deepSeekTuiRuntime);
  }

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

  async startSession(sessionId: string, prompt: string, options?: CoworkStartOptions): Promise<void> {
    const engine = this.resolveEngineForOptions(options?.agentEngine);
    this.sessionEngine.set(sessionId, engine);
    await this.runtimeByEngine[engine].startSession(sessionId, prompt, options);
  }

  async continueSession(sessionId: string, prompt: string, options?: CoworkContinueOptions): Promise<void> {
    const engine = this.resolveEngineForOptions(options?.agentEngine);
    this.sessionEngine.set(sessionId, engine);
    await this.runtimeByEngine[engine].continueSession(sessionId, prompt, options);
  }

  stopSession(sessionId: string): void {
    const engine = this.sessionEngine.get(sessionId);
    if (engine) {
      this.runtimeByEngine[engine].stopSession(sessionId);
    } else {
      for (const runtime of Object.values(this.runtimeByEngine)) {
        runtime.stopSession(sessionId);
      }
    }
    this.sessionEngine.delete(sessionId);
  }

  stopAllSessions(): void {
    for (const runtime of Object.values(this.runtimeByEngine)) {
      runtime.stopAllSessions();
    }
    this.sessionEngine.clear();
  }

  respondToPermission(requestId: string, result: PermissionResult): void {
    for (const runtime of Object.values(this.runtimeByEngine)) {
      runtime.respondToPermission(requestId, result);
    }
  }

  isSessionActive(sessionId: string): boolean {
    const engine = this.sessionEngine.get(sessionId);
    if (engine) {
      return this.runtimeByEngine[engine].isSessionActive(sessionId);
    }
    return false;
  }

  getSessionConfirmationMode(sessionId: string): 'modal' | 'text' | null {
    const engine = this.sessionEngine.get(sessionId);
    if (engine) {
      return this.runtimeByEngine[engine].getSessionConfirmationMode(sessionId);
    }
    for (const runtime of Object.values(this.runtimeByEngine)) {
      const mode = runtime.getSessionConfirmationMode(sessionId);
      if (mode) return mode;
    }
    return null;
  }

  onSessionDeleted(sessionId: string): void {
    this.sessionEngine.delete(sessionId);
    for (const runtime of Object.values(this.runtimeByEngine)) {
      runtime.onSessionDeleted?.(sessionId);
    }
  }

  /**
   * Handles engine configuration change by stopping all active sessions
   * and emitting errors with ENGINE_SWITCHED_CODE.
   */
  handleEngineConfigChanged(nextEngine: CoworkAgentEngineType): void {
    if (nextEngine === this.currentEngine) {
      return;
    }

    this.currentEngine = nextEngine;
    const activeSessionIds = Array.from(this.sessionEngine.keys())
      .filter((sessionId) => this.runtimeByEngine[this.sessionEngine.get(sessionId)!].isSessionActive(sessionId));
    this.stopAllSessions();

    for (const sessionId of activeSessionIds) {
      this.emit('error', sessionId, ENGINE_SWITCHED_CODE);
    }
  }

  private bindRuntimeEvents(engine: CoworkAgentEngineType, runtime: CoworkRuntime): void {
    runtime.on('message', (sessionId, message) => {
      this.sessionEngine.set(sessionId, engine);
      this.emit('message', sessionId, message);
    });

    runtime.on('messageUpdate', (sessionId, messageId, content) => {
      this.sessionEngine.set(sessionId, engine);
      this.emit('messageUpdate', sessionId, messageId, content);
    });

    runtime.on('permissionRequest', (sessionId, request) => {
      this.sessionEngine.set(sessionId, engine);
      this.emit('permissionRequest', sessionId, request);
    });

    runtime.on('runtimeMetric', (sessionId, metric) => {
      this.sessionEngine.set(sessionId, engine);
      this.emit('runtimeMetric', sessionId, metric);
    });

    runtime.on('complete', (sessionId, claudeSessionId) => {
      this.sessionEngine.delete(sessionId);
      this.emit('complete', sessionId, claudeSessionId);
    });

    runtime.on('error', (sessionId, error) => {
      this.sessionEngine.delete(sessionId);
      this.emit('error', sessionId, error);
    });

    runtime.on('sessionStopped', (sessionId) => {
      this.sessionEngine.delete(sessionId);
      this.emit('sessionStopped', sessionId);
    });
  }

  private resolveEngineForOptions(engine?: CoworkAgentEngineType): CoworkAgentEngineType {
    if (engine && isCoworkAgentEngine(engine)) {
      this.currentEngine = engine;
      return engine;
    }
    return this.currentEngine;
  }
}
