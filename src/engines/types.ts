/**
 * Shared types for engine adapters in the engines layer.
 */

export type EngineStatus = 'idle' | 'running' | 'error' | 'unavailable';

export interface EngineInfo {
  name: string;
  version?: string;
  status: EngineStatus;
  installPath?: string;
}

export interface EngineInstallResult {
  success: boolean;
  engine: string;
  version?: string;
  error?: string;
}
