/**
 * Agora — Frontend Station Types
 * Built-in frontend development environment.
 */

export type DevProjectTemplate = 'vite-react' | 'vite-vue' | 'nextjs' | 'blank';
export type DevServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface DevProject {
  id: string;
  name: string;
  template: DevProjectTemplate;
  path: string;
  port: number;
  status: DevServerStatus;
  createdAt: string;
}

export interface DevServerEvent {
  type: 'server-ready' | 'server-error' | 'hmr-update' | 'server-stopped';
  projectId: string;
  data?: {
    url?: string;
    error?: string;
    file?: string;
  };
}
