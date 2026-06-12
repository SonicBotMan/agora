import { describe, expect, it, vi } from 'vitest';

const ipcFacadeTestState = vi.hoisted(() => ({
  registerAllHandlers: vi.fn(),
  registerImCoreHandlers: vi.fn(),
  registerImFeishuManagementHandlers: vi.fn(),
  registerImFeishuInstanceHandlers: vi.fn(),
  registerImPairingHandlers: vi.fn(),
  registerImInstanceHandlers: vi.fn(),
  registerDialogHandlers: vi.fn(),
  registerResearchHandlers: vi.fn(),
  registerOrchestratorHandlers: vi.fn(),
  registerKnowledgeHandlers: vi.fn(),
  registerHotTopicsHandlers: vi.fn(),
  registerFrontendStationHandlers: vi.fn(),
  registerMcpHandlers: vi.fn(),
}));

vi.mock('../main/ipc', () => ({
  registerAllHandlers: ipcFacadeTestState.registerAllHandlers,
}));

vi.mock('../main/ipc/imCoreHandlers', () => ({
  registerImCoreHandlers: ipcFacadeTestState.registerImCoreHandlers,
}));

vi.mock('../main/ipc/imFeishuManagementHandlers', () => ({
  registerImFeishuManagementHandlers: ipcFacadeTestState.registerImFeishuManagementHandlers,
}));

vi.mock('../main/ipc/imFeishuInstanceHandlers', () => ({
  registerImFeishuInstanceHandlers: ipcFacadeTestState.registerImFeishuInstanceHandlers,
}));

vi.mock('../main/ipc/imPairingHandlers', () => ({
  registerImPairingHandlers: ipcFacadeTestState.registerImPairingHandlers,
}));

vi.mock('../main/ipc/imInstanceHandlers', () => ({
  registerImInstanceHandlers: ipcFacadeTestState.registerImInstanceHandlers,
}));

vi.mock('../main/ipc/dialogHandlers', () => ({
  registerDialogHandlers: ipcFacadeTestState.registerDialogHandlers,
}));

vi.mock('../main/ipc/researchHandlers', () => ({
  registerResearchHandlers: ipcFacadeTestState.registerResearchHandlers,
}));

vi.mock('../main/ipc/orchestratorHandlers', () => ({
  registerOrchestratorHandlers: ipcFacadeTestState.registerOrchestratorHandlers,
}));

vi.mock('../main/ipc/knowledgeHandlers', () => ({
  registerKnowledgeHandlers: ipcFacadeTestState.registerKnowledgeHandlers,
}));

vi.mock('../main/ipc/hotTopicsHandlers', () => ({
  registerHotTopicsHandlers: ipcFacadeTestState.registerHotTopicsHandlers,
}));

vi.mock('../main/ipc/frontendStationHandlers', () => ({
  registerFrontendStationHandlers:
    ipcFacadeTestState.registerFrontendStationHandlers,
}));

vi.mock('../main/ipc/mcpHandlers', () => ({
  registerMcpHandlers: ipcFacadeTestState.registerMcpHandlers,
}));

import { registerAttachmentHandlers } from './attachmentHandlers';
import { registerFrontendStationHandlers } from './frontendStationHandlers';
import { registerHotTopicsHandlers } from './hotTopicsHandlers';
import { registerImHandlers } from './imHandlers';
import { registerAllIpcHandlers } from './index';
import { registerKnowledgeHandlers } from './knowledgeHandlers';
import { registerMcpHandlers } from './mcpHandlers';
import { registerOrchestratorHandlers } from './orchestratorHandlers';
import { registerResearchHandlers } from './researchHandlers';

describe('ipc facade', () => {
  it('delegates the top-level registry to src/main/ipc', () => {
    const deps = { id: 'all-handlers' } as never;

    registerAllIpcHandlers(deps);

    expect(ipcFacadeTestState.registerAllHandlers).toHaveBeenCalledWith(deps);
  });

  it('composes all IM handler groups behind the documented facade', () => {
    const deps = { id: 'im-handlers' } as never;

    registerImHandlers(deps);

    expect(ipcFacadeTestState.registerImCoreHandlers).toHaveBeenCalledWith(deps);
    expect(ipcFacadeTestState.registerImFeishuManagementHandlers).toHaveBeenCalledWith(deps);
    expect(ipcFacadeTestState.registerImFeishuInstanceHandlers).toHaveBeenCalledWith(deps);
    expect(ipcFacadeTestState.registerImPairingHandlers).toHaveBeenCalledWith(deps);
    expect(ipcFacadeTestState.registerImInstanceHandlers).toHaveBeenCalledWith(deps);
  });

  it('maps attachment facade registration to the dialog handlers', () => {
    const deps = { getMainWindow: vi.fn() } as never;

    registerAttachmentHandlers(deps);

    expect(ipcFacadeTestState.registerDialogHandlers).toHaveBeenCalledWith(deps);
  });

  it('maps research facade registration to the main research handlers', () => {
    const deps = { getResearchSession: vi.fn() } as never;

    registerResearchHandlers(deps);

    expect(ipcFacadeTestState.registerResearchHandlers).toHaveBeenCalledWith(
      deps,
    );
  });

  it('maps orchestrator facade registration to the main orchestrator handlers', () => {
    const deps = { getCoworkEngineRouter: vi.fn() } as never;

    registerOrchestratorHandlers(deps);

    expect(
      ipcFacadeTestState.registerOrchestratorHandlers,
    ).toHaveBeenCalledWith(deps);
  });

  it('maps knowledge facade registration to the main knowledge handlers', () => {
    const deps = {
      getKnowledgeStore: vi.fn(),
      getKnowledgeSearchEngine: vi.fn(),
    } as never;

    registerKnowledgeHandlers(deps);

    expect(ipcFacadeTestState.registerKnowledgeHandlers).toHaveBeenCalledWith(
      deps,
    );
  });

  it('maps hot topics facade registration to the main hot topics handlers', () => {
    const deps = { getTopicMonitor: vi.fn() } as never;

    registerHotTopicsHandlers(deps);

    expect(ipcFacadeTestState.registerHotTopicsHandlers).toHaveBeenCalledWith(
      deps,
    );
  });

  it('maps frontend station facade registration to the main frontend station handlers', () => {
    const deps = { getFrontendStationRuntime: vi.fn() } as never;

    registerFrontendStationHandlers(deps);

    expect(
      ipcFacadeTestState.registerFrontendStationHandlers,
    ).toHaveBeenCalledWith(deps);
  });

  it('maps MCP facade registration to the main MCP handlers', () => {
    const deps = {
      getMcpStore: vi.fn(),
      refreshMcpBridge: vi.fn(),
      getServerApiBaseUrl: vi.fn(),
    } as never;

    registerMcpHandlers(deps);

    expect(ipcFacadeTestState.registerMcpHandlers).toHaveBeenCalledWith(deps);
  });
});
