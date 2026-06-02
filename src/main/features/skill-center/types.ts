/**
 * Agora — Skill Center Types
 * Enhanced skill lifecycle management.
 */

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  tags: string[];
  dependencies?: string[];
  entryFile: string;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
  source: 'bundled' | 'marketplace' | 'local';
}

export interface SkillSecurityReport {
  skillId: string;
  riskLevel: 'low' | 'medium' | 'high';
  issues: {
    type: string;
    description: string;
    file?: string;
    line?: number;
  }[];
  scannedAt: string;
}

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloadUrl: string;
  downloadCount: number;
  rating: number;
}
