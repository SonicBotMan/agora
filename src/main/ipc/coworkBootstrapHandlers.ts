import { ipcMain } from 'electron';

import type { SessionDeps } from './sessionDeps';

export type CoworkBootstrapDeps = Pick<
  SessionDeps,
  | 'getCoworkStore'
  | 'readBootstrapFile'
  | 'writeBootstrapFile'
>;

export function registerCoworkBootstrapHandlers(deps: CoworkBootstrapDeps): void {
  const {
    getCoworkStore,
    readBootstrapFile,
    writeBootstrapFile,
  } = deps;

  ipcMain.handle('cowork:bootstrap:read', async (_event, filename: string) => {
    try {
      const config = getCoworkStore().getConfig();
      const content = readBootstrapFile(config.workingDirectory, filename);
      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Failed to read bootstrap file',
      };
    }
  });

  ipcMain.handle('cowork:bootstrap:write', async (_event, filename: string, content: string) => {
    try {
      const config = getCoworkStore().getConfig();
      writeBootstrapFile(config.workingDirectory, filename, content);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write bootstrap file',
      };
    }
  });
}
