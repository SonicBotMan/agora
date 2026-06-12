import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoworkAgentEngine } from '../../shared/cowork/constants';
import { Orchestrator } from './Orchestrator';

class FakeRuntime extends EventEmitter {
  startSession = vi.fn<
    (sessionId: string, prompt: string) => Promise<void>
  >();

  stopSession = vi.fn((sessionId: string) => {
    this.emit('sessionStopped', sessionId);
  });

  isSessionActive = vi.fn(() => true);
}

describe('Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-selects the project development workflow for implementation goals', async () => {
    const orchestrator = new Orchestrator({
      runtime: new FakeRuntime() as never,
    });

    const graph = await orchestrator.plan(
      'Ship the frontend and backend implementation for the orchestrator workspace',
      'Use the existing React/Electron architecture and keep tests updated.',
    );

    expect(graph.source).toBe('auto');
    expect(graph.name).toBe('Project Development');
    expect(graph.nodes.map((node) => node.id)).toEqual([
      'requirements-analysis',
      'architecture-design',
      'backend-implementation',
      'frontend-implementation',
      'testing',
      'deployment',
    ]);
    expect(graph.nodes.find((node) => node.id === 'testing')).toMatchObject({
      agentEngine: CoworkAgentEngine.Codex,
      dependsOn: ['backend-implementation', 'frontend-implementation'],
    });
    for (const node of graph.nodes) {
      expect(node.prompt).toContain('[Shared Context]');
      expect(node.prompt).toContain('Use the existing React/Electron architecture');
    }
  });

  it('builds a structured fallback DAG when no template matches the goal', async () => {
    const orchestrator = new Orchestrator({
      runtime: new FakeRuntime() as never,
    });

    const graph = await orchestrator.plan('Coordinate a cross-team delivery checkpoint');

    expect(graph.source).toBe('auto');
    expect(graph.name).toBe('Structured Delivery Plan');
    expect(graph.nodes).toHaveLength(5);
    expect(graph.nodes.map((node) => node.id)).toEqual([
      'clarify-objective',
      'identify-workstreams',
      'implementation-plan',
      'verification-plan',
      'final-delivery-brief',
    ]);
    expect(graph.nodes.find((node) => node.id === 'clarify-objective')).toMatchObject({
      agentEngine: CoworkAgentEngine.Hermes,
      dependsOn: [],
    });
    expect(graph.nodes.find((node) => node.id === 'implementation-plan')).toMatchObject({
      agentEngine: CoworkAgentEngine.ClaudeCode,
      dependsOn: ['identify-workstreams'],
      retry: 1,
    });
    expect(graph.nodes.find((node) => node.id === 'final-delivery-brief')).toMatchObject({
      dependsOn: ['implementation-plan', 'verification-plan'],
    });
  });

  it('uses the explicit template when provided', async () => {
    const orchestrator = new Orchestrator({
      runtime: new FakeRuntime() as never,
    });

    const graph = await orchestrator.plan(
      'Prepare a market entry recommendation',
      'Prioritize differentiation and opportunity sizing.',
      'plan-design',
    );

    expect(graph.source).toBe('template');
    expect(graph.name).toBe('Plan & Design');
    expect(graph.nodes.map((node) => node.id)).toEqual([
      'background-research',
      'competitive-analysis',
      'brainstorming',
      'feasibility-evaluation',
      'final-plan',
    ]);
    for (const node of graph.nodes) {
      expect(node.prompt).toContain('[Shared Context]');
      expect(node.prompt).toContain('Prioritize differentiation and opportunity sizing.');
    }
  });
});
