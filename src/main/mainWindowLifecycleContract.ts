export type EngineStatusProvider = {
  getStatus: () => unknown;
};

export interface MainWindowLifecycleDeps {
  isDev: boolean;
  isQuitting: () => boolean;
  devServerUrl: string;
  errorPagePath: string;
  prodIndexPath: string;
  emitWindowState: () => void;
  scheduleReload: (reason: string) => void;
  onWindowClosed: () => void;
  openClawEngineManager: EngineStatusProvider | null;
  hermesEngineManager: EngineStatusProvider | null;
}
