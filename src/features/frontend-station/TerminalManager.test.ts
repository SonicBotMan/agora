import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalManager } from './TerminalManager';

describe('TerminalManager', () => {
  let outputHandler: ((data: string) => void) | null = null;
  let exitHandler: ((event: { exitCode: number }) => void) | null = null;

  beforeEach(() => {
    outputHandler = null;
    exitHandler = null;
  });

  it('creates sessions and forwards output / exit events', () => {
    const write = vi.fn();
    const resize = vi.fn();
    const kill = vi.fn();
    const terminalManager = new TerminalManager({
      spawnTerminal: vi.fn(() => ({
        write,
        resize,
        kill,
        onData: (callback) => {
          outputHandler = callback;
        },
        onExit: (callback) => {
          exitHandler = callback;
        },
      })),
      shell: '/bin/zsh',
      env: {
        TERM: 'xterm-256color',
      },
      initialCols: 120,
      initialRows: 32,
    });
    const outputEvents: string[] = [];
    const exitEvents: Array<number | null> = [];

    terminalManager.on('terminal-output', (event) => {
      outputEvents.push(event.data);
    });
    terminalManager.on('terminal-exit', (event) => {
      exitEvents.push(event.exitCode);
    });

    const session = terminalManager.createSession('project-1', '/tmp/agora-demo');
    expect(session).toMatchObject({
      projectId: 'project-1',
      cwd: '/tmp/agora-demo',
      shell: '/bin/zsh',
      status: 'running',
    });

    outputHandler?.('npm run dev\r\n');
    expect(terminalManager.getBuffer(session.sessionId)).toContain('npm run dev');
    expect(outputEvents).toEqual(['npm run dev\r\n']);

    terminalManager.write(session.sessionId, 'echo test\n');
    terminalManager.resize(session.sessionId, 80, 24);
    expect(write).toHaveBeenCalledWith('echo test\n');
    expect(resize).toHaveBeenCalledWith(80, 24);

    exitHandler?.({ exitCode: 0 });
    expect(exitEvents).toEqual([0]);
    expect(terminalManager.getSession(session.sessionId)).toMatchObject({
      status: 'exited',
      exitCode: 0,
    });

    terminalManager.destroySession(session.sessionId);
    expect(kill).not.toHaveBeenCalled();
    expect(terminalManager.getSession(session.sessionId)).toBeUndefined();
  });
});
