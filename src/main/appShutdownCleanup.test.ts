import { describe, expect, it, vi } from 'vitest';

import { runAppShutdownCleanup } from './appShutdownCleanup';

describe('appShutdownCleanup', () => {
  it('runs cleanup steps in order and continues past recoverable failures', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const events: string[] = [];
    const openAiProxyError = new Error('proxy');
    const imGatewayError = new Error('im');
    const openClawError = new Error('openclaw');
    const mcpBridgeError = new Error('mcp');

    await runAppShutdownCleanup({
      destroyTray: vi.fn(() => {
        events.push('destroyTray');
      }),
      stopHermesIMSessionSyncPolling: vi.fn(() => {
        events.push('stopHermesIMSessionSyncPolling');
      }),
      stopSkillWatcher: vi.fn(() => {
        events.push('stopSkillWatcher');
      }),
      stopCoworkSessions: vi.fn(() => {
        events.push('stopCoworkSessions');
      }),
      stopCoworkFileActivity: vi.fn(() => {
        events.push('stopCoworkFileActivity');
      }),
      stopCoworkOpenAICompatProxy: vi.fn(async () => {
        events.push('stopCoworkOpenAICompatProxy');
        throw openAiProxyError;
      }),
      stopOpenClawTokenProxy: vi.fn(() => {
        events.push('stopOpenClawTokenProxy');
      }),
      stopSkillServices: vi.fn(async () => {
        events.push('stopSkillServices');
      }),
      stopIMGateways: vi.fn(async () => {
        events.push('stopIMGateways');
        throw imGatewayError;
      }),
      stopOpenClawGateway: vi.fn(async () => {
        events.push('stopOpenClawGateway');
        throw openClawError;
      }),
      stopMcpBridge: vi.fn(async () => {
        events.push('stopMcpBridge');
        throw mcpBridgeError;
      }),
      stopCronPolling: vi.fn(() => {
        events.push('stopCronPolling');
        throw new Error('cron');
      }),
      closeStore: vi.fn(() => {
        events.push('closeStore');
        throw new Error('store');
      }),
    });

    expect(events).toEqual([
      'destroyTray',
      'stopHermesIMSessionSyncPolling',
      'stopSkillWatcher',
      'stopCoworkSessions',
      'stopCoworkFileActivity',
      'stopCoworkOpenAICompatProxy',
      'stopOpenClawTokenProxy',
      'stopSkillServices',
      'stopIMGateways',
      'stopOpenClawGateway',
      'stopMcpBridge',
      'stopCronPolling',
      'closeStore',
    ]);
    expect(logSpy).toHaveBeenCalledWith(
      '[Main] App is quitting, starting cleanup...',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to stop OpenAI compatibility proxy:',
      openAiProxyError,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[IM Gateway] Error stopping gateways on quit:',
      imGatewayError,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[OpenClaw] Failed to stop gateway on quit:',
      openClawError,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[McpBridge] Failed to stop bridge on quit:',
      mcpBridgeError,
    );

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
