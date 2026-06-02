/**
 * AgentPool — manages available Agent registrations.
 * Agents can be registered, unregistered, and queried by availability.
 */

import type { CoworkAgentEngine } from '../../shared/cowork/constants';
import type { AgentRegistration } from './types';

export class AgentPool {
  private agents: Map<string, AgentRegistration> = new Map();

  /** Register an agent into the pool. */
  register(engine: CoworkAgentEngine, label: string, agentId?: string): void {
    const key = this.buildKey(engine, agentId);
    this.agents.set(key, {
      engine,
      agentId,
      label,
      available: true,
    });
  }

  /** Unregister an agent from the pool. */
  unregister(engine: CoworkAgentEngine, agentId?: string): boolean {
    const key = this.buildKey(engine, agentId);
    return this.agents.delete(key);
  }

  /** Mark an agent as available (free to take tasks). */
  markAvailable(engine: CoworkAgentEngine, agentId?: string): boolean {
    const key = this.buildKey(engine, agentId);
    const agent = this.agents.get(key);
    if (!agent) return false;
    agent.available = true;
    return true;
  }

  /** Mark an agent as busy (currently executing a task). */
  markBusy(engine: CoworkAgentEngine, agentId?: string): boolean {
    const key = this.buildKey(engine, agentId);
    const agent = this.agents.get(key);
    if (!agent) return false;
    agent.available = false;
    return true;
  }

  /** Get all available (free) agents. */
  getAvailable(): AgentRegistration[] {
    return Array.from(this.agents.values()).filter(a => a.available);
  }

  /** Get all registered agents regardless of availability. */
  getAll(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  /** Get count of available agents. */
  getAvailableCount(): number {
    return this.getAvailable().length;
  }

  /** Find a suitable available agent for a given engine. */
  findForEngine(engine: CoworkAgentEngine): AgentRegistration | undefined {
    return this.getAvailable().find(a => a.engine === engine);
  }

  /** Check if a specific agent is registered and available. */
  isAvailable(engine: CoworkAgentEngine, agentId?: string): boolean {
    const key = this.buildKey(engine, agentId);
    const agent = this.agents.get(key);
    return agent?.available === true;
  }

  /** Clear all agents from the pool. */
  clear(): void {
    this.agents.clear();
  }

  /** Build a unique key for an agent entry. */
  private buildKey(engine: CoworkAgentEngine, agentId?: string): string {
    return agentId ? `${engine}:${agentId}` : engine;
  }
}
