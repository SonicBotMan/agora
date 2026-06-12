import { BrowserWindow, ipcMain } from 'electron';

import type {
  ResearchQuery,
  ResearchSession,
  ResearchSessionEvent,
} from '../../features/deep-research';

export interface ResearchDeps {
  getResearchSession: () => ResearchSession;
}

export function registerResearchHandlers(deps: ResearchDeps): void {
  let researchSession: ResearchSession | null = null;
  let eventsBound = false;

  const getResearchSession = (): ResearchSession => {
    if (!researchSession) {
      researchSession = deps.getResearchSession();
    }

    if (!eventsBound) {
      researchSession.on('research:event', (event: ResearchSessionEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
          if (window.isDestroyed()) continue;
          window.webContents.send('research:event', event);
        }
      });
      eventsBound = true;
    }

    return researchSession;
  };

  ipcMain.handle('research:start', async (_event, query: ResearchQuery) => {
    try {
      return {
        success: true,
        session: getResearchSession().create(query),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to start research session',
      };
    }
  });

  ipcMain.handle('research:cancel', async (_event, id: string) => {
    try {
      return {
        success: true,
        cancelled: getResearchSession().cancel(id),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to cancel research session',
      };
    }
  });

  ipcMain.handle('research:getStatus', async (_event, id: string) => {
    try {
      return {
        success: true,
        session: getResearchSession().get(id) ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get research session status',
      };
    }
  });

  ipcMain.handle('research:getResult', async (_event, id: string) => {
    try {
      return {
        success: true,
        result: getResearchSession().getResult(id),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get research result',
      };
    }
  });

  ipcMain.handle('research:list', async () => {
    try {
      return {
        success: true,
        sessions: getResearchSession().list(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to list research sessions',
      };
    }
  });

  ipcMain.handle('research:getReport', async (_event, id: string) => {
    try {
      return {
        success: true,
        report: getResearchSession().getReport(id),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get research report',
      };
    }
  });

  ipcMain.handle(
    'research:pushToIM',
    async (_event, id: string, channels: string[]) => {
      try {
        return {
          success: true,
          result: await getResearchSession().pushToIM(id, channels),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to deliver research report to IM',
        };
      }
    },
  );
}
