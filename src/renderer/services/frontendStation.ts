import type {
  DevProject,
  EditorFile,
  FrontendStationEvent,
  PreviewState,
  ProjectFileNode,
  ProjectTemplate,
  TemplateConfig,
  TerminalSession,
} from '../../features/frontend-station';

class FrontendStationService {
  async listTemplates(): Promise<TemplateConfig[]> {
    try {
      return await window.electron.frontendStation.listTemplates();
    } catch (error) {
      console.error('Failed to list frontend station templates:', error);
      return [];
    }
  }

  async createProject(options: {
    name: string;
    template: ProjectTemplate;
    path: string;
  }): Promise<DevProject | null> {
    try {
      return await window.electron.frontendStation.createProject(options);
    } catch (error) {
      console.error('Failed to create frontend station project:', error);
      return null;
    }
  }

  async getProjects(): Promise<DevProject[]> {
    try {
      return await window.electron.frontendStation.getProjects();
    } catch (error) {
      console.error('Failed to list frontend station projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<DevProject | null> {
    try {
      return await window.electron.frontendStation.getProject(projectId);
    } catch (error) {
      console.error('Failed to get frontend station project:', error);
      return null;
    }
  }

  async startServer(projectId: string): Promise<{
    project: DevProject | null;
    preview: PreviewState | null;
  } | null> {
    try {
      return await window.electron.frontendStation.startServer(projectId);
    } catch (error) {
      console.error('Failed to start frontend station server:', error);
      return null;
    }
  }

  async stopServer(projectId: string): Promise<DevProject | null> {
    try {
      return await window.electron.frontendStation.stopServer(projectId);
    } catch (error) {
      console.error('Failed to stop frontend station server:', error);
      return null;
    }
  }

  async restartServer(projectId: string): Promise<{
    project: DevProject | null;
    preview: PreviewState | null;
  } | null> {
    try {
      return await window.electron.frontendStation.restartServer(projectId);
    } catch (error) {
      console.error('Failed to restart frontend station server:', error);
      return null;
    }
  }

  async getPreview(projectId: string): Promise<PreviewState | null> {
    try {
      return await window.electron.frontendStation.getPreview(projectId);
    } catch (error) {
      console.error('Failed to get frontend station preview:', error);
      return null;
    }
  }

  async getPreviews(): Promise<PreviewState[]> {
    try {
      return await window.electron.frontendStation.getPreviews();
    } catch (error) {
      console.error('Failed to list frontend station previews:', error);
      return [];
    }
  }

  async getFileTree(projectId: string): Promise<ProjectFileNode[]> {
    try {
      return await window.electron.frontendStation.getFileTree(projectId);
    } catch (error) {
      console.error('Failed to list frontend station files:', error);
      return [];
    }
  }

  async openFile(projectId: string, filePath: string): Promise<EditorFile | null> {
    try {
      return await window.electron.frontendStation.openFile(projectId, filePath);
    } catch (error) {
      console.error('Failed to open frontend station file:', error);
      return null;
    }
  }

  async saveFile(options: {
    projectId: string;
    filePath: string;
    content: string;
  }): Promise<EditorFile | null> {
    try {
      return await window.electron.frontendStation.saveFile(options);
    } catch (error) {
      console.error('Failed to save frontend station file:', error);
      return null;
    }
  }

  async createTerminalSession(projectId: string): Promise<TerminalSession | null> {
    try {
      return await window.electron.frontendStation.createTerminalSession(projectId);
    } catch (error) {
      console.error('Failed to create frontend station terminal session:', error);
      return null;
    }
  }

  async getTerminalBuffer(sessionId: string): Promise<string> {
    try {
      return await window.electron.frontendStation.getTerminalBuffer(sessionId);
    } catch (error) {
      console.error('Failed to get frontend station terminal buffer:', error);
      return '';
    }
  }

  async writeTerminal(sessionId: string, data: string): Promise<boolean> {
    try {
      return await window.electron.frontendStation.writeTerminal(sessionId, data);
    } catch (error) {
      console.error('Failed to write to frontend station terminal:', error);
      return false;
    }
  }

  async resizeTerminal(options: {
    sessionId: string;
    cols: number;
    rows: number;
  }): Promise<boolean> {
    try {
      return await window.electron.frontendStation.resizeTerminal(options);
    } catch (error) {
      console.error('Failed to resize frontend station terminal:', error);
      return false;
    }
  }

  async destroyTerminalSession(sessionId: string): Promise<boolean> {
    try {
      return await window.electron.frontendStation.destroyTerminalSession(sessionId);
    } catch (error) {
      console.error('Failed to destroy frontend station terminal session:', error);
      return false;
    }
  }

  onEvent(callback: (event: FrontendStationEvent) => void): () => void {
    return window.electron.frontendStation.onEvent(callback);
  }
}

export const frontendStationService = new FrontendStationService();
