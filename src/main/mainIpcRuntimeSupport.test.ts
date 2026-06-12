import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mainIpcRuntimeImSupport', () => ({
  createMainIpcRuntimeImHandlerDeps: vi.fn(),
}));

vi.mock('./mainIpcRuntimeServiceSupport', () => ({
  createMainIpcRuntimeServiceHandlerDeps: vi.fn(),
}));

vi.mock('./mainIpcRuntimeSessionSupport', () => ({
  createMainIpcRuntimeSessionHandlerDeps: vi.fn(),
}));

import { createMainIpcRuntimeImHandlerDeps } from './mainIpcRuntimeImSupport';
import { createMainIpcRuntimeServiceHandlerDeps } from './mainIpcRuntimeServiceSupport';
import { createMainIpcRuntimeSessionHandlerDeps } from './mainIpcRuntimeSessionSupport';
import { createMainIpcRuntimeHandlerDeps } from './mainIpcRuntimeSupport';

describe('mainIpcRuntimeSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines session, IM, and service handler deps from their dedicated builders', () => {
    const deps = { id: 'runtime-builder-deps' };
    vi.mocked(createMainIpcRuntimeSessionHandlerDeps).mockReturnValue(
      { sessionKey: 'session' } as never,
    );
    vi.mocked(createMainIpcRuntimeImHandlerDeps).mockReturnValue(
      { imKey: 'im' } as never,
    );
    vi.mocked(createMainIpcRuntimeServiceHandlerDeps).mockReturnValue(
      {
        engines: { engineKey: 'engines' },
        agents: { agentKey: 'agents' },
        mcp: { mcpKey: 'mcp' },
        api: { apiKey: 'api' },
      } as never,
    );

    expect(createMainIpcRuntimeHandlerDeps(deps as never)).toEqual({
      sessions: { sessionKey: 'session' },
      im: { imKey: 'im' },
      engines: { engineKey: 'engines' },
      agents: { agentKey: 'agents' },
      mcp: { mcpKey: 'mcp' },
      api: { apiKey: 'api' },
    });
    expect(createMainIpcRuntimeSessionHandlerDeps).toHaveBeenCalledWith(deps);
    expect(createMainIpcRuntimeImHandlerDeps).toHaveBeenCalledWith(deps);
    expect(createMainIpcRuntimeServiceHandlerDeps).toHaveBeenCalledWith(deps);
  });
});
