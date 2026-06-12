import { EventEmitter } from 'events';

import { SkillInstallResult,SkillManifest } from './types';

export declare interface SkillManagerEvents {
  installed: (skill: SkillManifest) => void;
  uninstalled: (id: string) => void;
  enabled: (id: string) => void;
  disabled: (id: string) => void;
  updated: (skill: SkillManifest) => void;
}

export class SkillManager extends EventEmitter {
  private skills: Map<string, SkillManifest> = new Map();

  constructor() {
    super();
  }

  on<Ev extends keyof SkillManagerEvents>(
    event: Ev,
    listener: SkillManagerEvents[Ev]
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  emit<Ev extends keyof SkillManagerEvents>(
    event: Ev,
    ...args: Parameters<SkillManagerEvents[Ev]>
  ): boolean {
    return super.emit(event, ...args);
  }

  async install(source: string): Promise<SkillInstallResult> {
    try {
      const manifest: SkillManifest = {
        id: `skill-${Date.now()}`,
        name: source,
        version: '1.0.0',
        description: '',
        author: 'unknown',
        tags: [],
        entryFile: source,
        enabled: true,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'local',
      };
      this.skills.set(manifest.id, manifest);
      this.emit('installed', manifest);
      return { success: true, message: `Skill "${source}" installed.`, skill: manifest };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Install failed: ${message}` };
    }
  }

  async uninstall(id: string): Promise<void> {
    this.skills.delete(id);
    this.emit('uninstalled', id);
  }

  enable(id: string): void {
    const skill = this.skills.get(id);
    if (skill) {
      skill.enabled = true;
      this.emit('enabled', id);
    }
  }

  disable(id: string): void {
    const skill = this.skills.get(id);
    if (skill) {
      skill.enabled = false;
      this.emit('disabled', id);
    }
  }

  list(): SkillManifest[] {
    return Array.from(this.skills.values());
  }

  get(id: string): SkillManifest | undefined {
    return this.skills.get(id);
  }

  async update(id: string): Promise<SkillInstallResult> {
    const existing = this.skills.get(id);
    if (!existing) {
      return { success: false, message: `Skill "${id}" not found.` };
    }
    existing.updatedAt = new Date().toISOString();
    this.skills.set(id, existing);
    this.emit('updated', existing);
    return { success: true, message: `Skill "${existing.name}" updated.`, skill: existing };
  }
}
