import { BrowserWindow, ipcMain } from 'electron';

import type {
  FrontendStationEvent,
  FrontendStationRuntime,
  ProjectTemplate,
} from '../../features/frontend-station';

export interface FrontendStationDeps {
  getFrontendStationRuntime: () => FrontendStationRuntime;
}

export function registerFrontendStationHandlers(
  deps: FrontendStationDeps,
): void {
  let frontendStationRuntime: FrontendStationRuntime | null = null;
  let eventsBound = false;

  const getFrontendStationRuntime = (): FrontendStationRuntime => {
    if (!frontendStationRuntime) {
      frontendStationRuntime = deps.getFrontendStationRuntime();
    }

    if (!eventsBound) {
      frontendStationRuntime.on(
        'frontend:event',
        (event: FrontendStationEvent) => {
          for (const window of BrowserWindow.getAllWindows()) {
            if (window.isDestroyed()) continue;
            window.webContents.send('frontendStation:event', event);
          }
        },
      );
      eventsBound = true;
    }

    return frontendStationRuntime;
  };

  ipcMain.handle('frontendStation:listTemplates', async () => {
    try {
      return {
        success: true,
        templates: getFrontendStationRuntime().listTemplates(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to list frontend station templates',
      };
    }
  });

  ipcMain.handle(
    'frontendStation:createProject',
    async (
      _event,
      options: { name: string; template: ProjectTemplate; path: string },
    ) => {
      try {
        return {
          success: true,
          project: await getFrontendStationRuntime().createProject(options),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to create frontend station project',
        };
      }
    },
  );

  ipcMain.handle('frontendStation:getProjects', async () => {
    try {
      return {
        success: true,
        projects: getFrontendStationRuntime().getProjects(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to list frontend station projects',
      };
    }
  });

  ipcMain.handle('frontendStation:getProject', async (_event, projectId: string) => {
    try {
      return {
        success: true,
        project: getFrontendStationRuntime().getProject(projectId) ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get frontend station project',
      };
    }
  });

  ipcMain.handle('frontendStation:startServer', async (_event, projectId: string) => {
    try {
      return {
        success: true,
        ...(await getFrontendStationRuntime().startServer(projectId)),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to start frontend station server',
      };
    }
  });

  ipcMain.handle('frontendStation:stopServer', async (_event, projectId: string) => {
    try {
      return {
        success: true,
        ...(await getFrontendStationRuntime().stopServer(projectId)),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to stop frontend station server',
      };
    }
  });

  ipcMain.handle(
    'frontendStation:restartServer',
    async (_event, projectId: string) => {
      try {
        return {
          success: true,
          ...(await getFrontendStationRuntime().restartServer(projectId)),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to restart frontend station server',
        };
      }
    },
  );

  ipcMain.handle('frontendStation:getPreview', async (_event, projectId: string) => {
    try {
      return {
        success: true,
        preview: getFrontendStationRuntime().getPreview(projectId) ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to get frontend station preview',
      };
    }
  });

  ipcMain.handle('frontendStation:getPreviews', async () => {
    try {
      return {
        success: true,
        previews: getFrontendStationRuntime().getPreviews(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to list frontend station previews',
      };
    }
  });

  ipcMain.handle('frontendStation:getFileTree', async (_event, projectId: string) => {
    try {
      return {
        success: true,
        files: await getFrontendStationRuntime().getFileTree(projectId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to list frontend station files',
      };
    }
  });

  ipcMain.handle(
    'frontendStation:openFile',
    async (_event, projectId: string, filePath: string) => {
      try {
        return {
          success: true,
          file: await getFrontendStationRuntime().openFile(projectId, filePath),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to open frontend station file',
        };
      }
    },
  );

  ipcMain.handle(
    'frontendStation:saveFile',
    async (
      _event,
      options: { projectId: string; filePath: string; content: string },
    ) => {
      try {
        return {
          success: true,
          file: await getFrontendStationRuntime().saveFile(
            options.projectId,
            options.filePath,
            options.content,
          ),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to save frontend station file',
        };
      }
    },
  );

  ipcMain.handle(
    'frontendStation:createTerminalSession',
    async (_event, projectId: string) => {
      try {
        return {
          success: true,
          session: getFrontendStationRuntime().createTerminalSession(projectId),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to create frontend station terminal session',
        };
      }
    },
  );

  ipcMain.handle(
    'frontendStation:getTerminalBuffer',
    async (_event, sessionId: string) => {
      try {
        return {
          success: true,
          buffer: getFrontendStationRuntime().getTerminalBuffer(sessionId),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to get frontend station terminal buffer',
        };
      }
    },
  );

  ipcMain.handle(
    'frontendStation:writeTerminal',
    async (_event, sessionId: string, data: string) => {
      try {
        getFrontendStationRuntime().writeTerminal(sessionId, data);
        return {
          success: true,
          written: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to write to frontend station terminal',
        };
      }
    },
  );

  ipcMain.handle(
    'frontendStation:resizeTerminal',
    async (
      _event,
      options: { sessionId: string; cols: number; rows: number },
    ) => {
      try {
        getFrontendStationRuntime().resizeTerminal(
          options.sessionId,
          options.cols,
          options.rows,
        );
        return {
          success: true,
          resized: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to resize frontend station terminal',
        };
      }
    },
  );

  ipcMain.handle(
    'frontendStation:destroyTerminalSession',
    async (_event, sessionId: string) => {
      try {
        return {
          success: true,
          destroyed: getFrontendStationRuntime().destroyTerminalSession(sessionId),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to destroy frontend station terminal session',
        };
      }
    },
  );
}
