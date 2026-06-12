import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { KnowledgeDocument } from '../features/knowledge-base';

const mainRuntimeRegistryServiceSupportTestState = vi.hoisted(() => {
  const createMcpBridgeRuntime = vi.fn();
  const getExternalAgentEnvironmentSnapshot = vi.fn();
  const externalAgentCliInstallerInstances: Array<Record<string, unknown>> = [];
  const deepSeekTuiRuntimeManagerInstances: Array<Record<string, unknown>> = [];
  const skillManagerInstances: Array<{ getStore: unknown }> = [];

  class MockExternalAgentCliInstaller {
    constructor() {
      externalAgentCliInstallerInstances.push(this);
    }
  }

  class MockDeepSeekTuiRuntimeManager {
    constructor() {
      deepSeekTuiRuntimeManagerInstances.push(this);
    }
  }

  class MockSkillManager {
    getStore: unknown;

    constructor(getStore: unknown) {
      this.getStore = getStore;
      skillManagerInstances.push({ getStore });
    }
  }

  return {
    createMcpBridgeRuntime,
    getExternalAgentEnvironmentSnapshot,
    externalAgentCliInstallerInstances,
    deepSeekTuiRuntimeManagerInstances,
    skillManagerInstances,
    MockExternalAgentCliInstaller,
    MockDeepSeekTuiRuntimeManager,
    MockSkillManager,
  };
});

vi.mock('./mcpBridgeRuntime', () => ({
  createMcpBridgeRuntime:
    mainRuntimeRegistryServiceSupportTestState.createMcpBridgeRuntime,
}));

vi.mock('./libs/externalAgentEnvironment', () => ({
  getExternalAgentEnvironmentSnapshot:
    mainRuntimeRegistryServiceSupportTestState.getExternalAgentEnvironmentSnapshot,
}));

vi.mock('./libs/externalAgentCliInstaller', () => ({
  ExternalAgentCliInstaller:
    mainRuntimeRegistryServiceSupportTestState.MockExternalAgentCliInstaller,
}));

vi.mock('./libs/deepSeekTuiRuntimeManager', () => ({
  DeepSeekTuiRuntimeManager:
    mainRuntimeRegistryServiceSupportTestState.MockDeepSeekTuiRuntimeManager,
}));

vi.mock('./skillManager', () => ({
  SkillManager: mainRuntimeRegistryServiceSupportTestState.MockSkillManager,
}));

import { createMainRuntimeRegistryServiceSupport } from './mainRuntimeRegistryServiceSupport';

function createDeps() {
  const db = new Database(':memory:');
  const getIMGatewayManager = vi.fn().mockReturnValue({
    getIMStore: () => ({
      getNotificationTarget: vi.fn(),
    }),
    sendConversationReply: vi.fn(),
  });

  return {
    db,
    getStore: vi.fn().mockReturnValue({
      getDatabase: () => db,
    }),
    getWindows: vi.fn().mockReturnValue([]),
    getIMGatewayManager,
    syncOpenClawConfig: vi.fn().mockResolvedValue({
      success: true,
      changed: false,
    }),
  };
}

function createKnowledgeDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: 'knowledge-1',
    title: 'Persistent Knowledge',
    source: 'manual',
    content: 'Stored through the main runtime registry support.',
    contentType: 'markdown',
    metadata: {
      tags: ['agora', 'knowledge'],
      entities: [],
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('mainRuntimeRegistryServiceSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainRuntimeRegistryServiceSupportTestState.externalAgentCliInstallerInstances.length = 0;
    mainRuntimeRegistryServiceSupportTestState.deepSeekTuiRuntimeManagerInstances.length = 0;
    mainRuntimeRegistryServiceSupportTestState.skillManagerInstances.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates singleton service runtimes and returns a copied environment snapshot', async () => {
    const deps = createDeps();
    const mcpBridgeRuntime = { id: 'mcp-bridge-runtime' };
    let capturedDeps: Record<string, unknown> | null = null;

    mainRuntimeRegistryServiceSupportTestState.createMcpBridgeRuntime
      .mockImplementation((input) => {
        capturedDeps = input as never;
        return mcpBridgeRuntime as never;
      });
    mainRuntimeRegistryServiceSupportTestState.getExternalAgentEnvironmentSnapshot
      .mockReturnValue({
        OPENAI_API_KEY: 'sk-test',
      });

    const support = createMainRuntimeRegistryServiceSupport(deps as never);

    expect(support.peekSkillManager()).toBeNull();
    expect(support.getMcpBridgeRuntime()).toBe(mcpBridgeRuntime);
    expect(support.getMcpBridgeRuntime()).toBe(mcpBridgeRuntime);
    expect(
      mainRuntimeRegistryServiceSupportTestState.createMcpBridgeRuntime,
    ).toHaveBeenCalledTimes(1);
    expect(capturedDeps?.getStore).toBe(deps.getStore);
    expect(capturedDeps?.getWindows).toBe(deps.getWindows);

    await expect(
      (
        capturedDeps?.syncOpenClawConfig as
          | ((options: { reason: string }) => Promise<unknown>)
          | undefined
      )?.({ reason: 'bridge-refresh' }),
    ).resolves.toEqual({
      success: true,
      changed: false,
    });
    expect(deps.syncOpenClawConfig).toHaveBeenCalledWith({
      reason: 'bridge-refresh',
    });

    const firstInstaller = support.getExternalAgentCliInstaller();
    const secondInstaller = support.getExternalAgentCliInstaller();
    expect(firstInstaller).toBe(secondInstaller);
    expect(
      mainRuntimeRegistryServiceSupportTestState.externalAgentCliInstallerInstances,
    ).toHaveLength(1);

    const firstDeepSeek = support.getDeepSeekTuiRuntimeManager();
    const secondDeepSeek = support.getDeepSeekTuiRuntimeManager();
    expect(firstDeepSeek).toBe(secondDeepSeek);
    expect(
      mainRuntimeRegistryServiceSupportTestState.deepSeekTuiRuntimeManagerInstances,
    ).toHaveLength(1);

    const snapshot = support.getMergedExternalAgentEnvironmentSnapshot();
    expect(snapshot).toEqual({
      OPENAI_API_KEY: 'sk-test',
    });
    expect(snapshot).not.toBe(
      mainRuntimeRegistryServiceSupportTestState.getExternalAgentEnvironmentSnapshot
        .mock.results[0]?.value,
    );

    const firstSkillManager = support.getSkillManager();
    const secondSkillManager = support.getSkillManager();
    expect(firstSkillManager).toBe(secondSkillManager);
    expect(support.peekSkillManager()).toBe(firstSkillManager);
    expect(
      mainRuntimeRegistryServiceSupportTestState.skillManagerInstances,
    ).toEqual([{ getStore: deps.getStore }]);

    const firstKnowledgeStore = support.getKnowledgeStore();
    const secondKnowledgeStore = support.getKnowledgeStore();
    expect(firstKnowledgeStore).toBe(secondKnowledgeStore);

    const firstKnowledgeSearch = support.getKnowledgeSearchEngine();
    const secondKnowledgeSearch = support.getKnowledgeSearchEngine();
    expect(firstKnowledgeSearch).toBe(secondKnowledgeSearch);

    const firstConversationIngestor = support.getConversationIngestor();
    const secondConversationIngestor = support.getConversationIngestor();
    expect(firstConversationIngestor).toBe(secondConversationIngestor);

    const firstResearchSession = support.getResearchSession();
    const secondResearchSession = support.getResearchSession();
    expect(firstResearchSession).toBe(secondResearchSession);

    const firstTopicMonitor = support.getTopicMonitor();
    const secondTopicMonitor = support.getTopicMonitor();
    expect(firstTopicMonitor).toBe(secondTopicMonitor);
    const internalDispatcher = (
      firstTopicMonitor as unknown as {
        actionDispatcher?: { getIMGatewayManager?: unknown };
      }
    ).actionDispatcher;
    expect(internalDispatcher?.getIMGatewayManager).toBe(
      deps.getIMGatewayManager,
    );

    const firstFrontendStation = support.getFrontendStationRuntime();
    const secondFrontendStation = support.getFrontendStationRuntime();
    expect(firstFrontendStation).toBe(secondFrontendStation);

    deps.db.close();
  });

  it('hydrates the knowledge store from sqlite-backed persistence across support instances', async () => {
    const deps = createDeps();

    const firstSupport = createMainRuntimeRegistryServiceSupport(deps as never);
    const document = createKnowledgeDocument();

    await firstSupport.getKnowledgeStore().save(document);
    expect(await firstSupport.getKnowledgeStore().get(document.id)).toMatchObject({
      id: document.id,
      title: document.title,
    });

    const secondSupport = createMainRuntimeRegistryServiceSupport(deps as never);
    const rehydrated = await secondSupport.getKnowledgeStore().get(document.id);

    expect(rehydrated).toMatchObject({
      id: document.id,
      title: document.title,
      metadata: expect.objectContaining({
        tags: ['agora', 'knowledge'],
      }),
    });

    deps.db.close();
  });
});
