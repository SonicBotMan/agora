import { EventEmitter } from 'events';

export type SkillSource = 'builtin' | 'marketplace' | 'local';

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  entryFile: string;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
  source: SkillSource;
}

export interface SkillPermission {
  readFiles: string[];
  writeFiles: string[];
  executeCommands: string[];
  networkAccess: string[];
}

export interface SkillInstallResult {
  success: boolean;
  message: string;
  skill?: SkillManifest;
}

export interface SkillSecurityReport {
  safe: boolean;
  issues: string[];
}
