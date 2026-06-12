/**
 * Agora — Agent Orchestrator IPC Handlers
 *
 * Bridges the agent orchestrator feature into the main-process IPC surface.
 * Exposes planning, execution, cancellation, status lookup, and template list
 * APIs while forwarding orchestrator runtime events to renderer windows.
 */

import { BrowserWindow, ipcMain } from 'electron';

import {
  Orchestrator,
  type OrchestratorEvent,
} from '../../features/agent-orchestrator';
import type { SessionDeps } from './sessionDeps';

export interface OrchestratorDeps {
  getCoworkEngineRouter: SessionDeps['getCoworkEngineRouter'];
}

export function registerOrchestratorHandlers(deps: OrchestratorDeps): void {
  let orchestrator: Orchestrator | null = null;

  const getOrchestrator = (): Orchestrator => {
    if (!orchestrator) {
      orchestrator = new Orchestrator({
        runtime: deps.getCoworkEngineRouter(),
      });
      orchestrator.on('orchestrator:event', (event: OrchestratorEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
          if (window.isDestroyed()) continue;
          window.webContents.send('orchestrator:event', event);
        }
      });
    }
    return orchestrator;
  };

  ipcMain.handle('orchestrator:listTemplates', async () => {
    try {
      return {
        success: true,
        templates: getOrchestrator().listTemplates(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to list orchestrator templates',
      };
    }
  });

  ipcMain.handle(
    'orchestrator:plan',
    async (_event, goal: string, context?: string, templateId?: string) => {
      try {
        const graph = await getOrchestrator().plan(goal, context, templateId);
        return { success: true, graph };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to create orchestrator plan',
        };
      }
    },
  );

  ipcMain.handle('orchestrator:execute', async (_event, graphId: string) => {
    try {
      const orchestratorInstance = getOrchestrator();
      const graph = orchestratorInstance.getGraphStatus(graphId);
      if (!graph) {
        return { success: false, error: `Orchestrator graph "${graphId}" not found` };
      }

      const result = await orchestratorInstance.execute(graph);
      return {
        success: true,
        graph: result,
        summary: orchestratorInstance.aggregate(result),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to execute orchestrator graph',
      };
    }
  });

  ipcMain.handle('orchestrator:cancel', async (_event, graphId: string) => {
    try {
      return {
        success: true,
        cancelled: getOrchestrator().cancelGraph(graphId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to cancel orchestrator graph',
      };
    }
  });

  ipcMain.handle('orchestrator:getStatus', async (_event, graphId: string) => {
    try {
      return {
        success: true,
        graph: getOrchestrator().getGraphStatus(graphId) ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get orchestrator graph status',
      };
    }
  });
}
