import type { SkillManifest } from './types';

const DEFAULT_API_BASE = 'https://skillhub.club/api/v1';
const DEFAULT_WEB_BASE = 'https://skillhub.lol';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_LIMIT = 24;
const DEFAULT_MAX_RETRIES = 2;

type FetchLike = typeof fetch;

type RawMarketplaceSkill = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  author?: string | null;
  description?: string | null;
  description_zh?: string | null;
  category?: string | null;
  tags?: string[] | null;
  repo_url?: string | null;
  version?: string | null;
  simple_score?: number | null;
  github_stars?: number | null;
  skill_md_raw?: string | null;
};

type MarketplaceListPayload = {
  skills?: RawMarketplaceSkill[];
};

type MarketplaceDetailPayload = {
  skill?: RawMarketplaceSkill | null;
};

export interface SkillMarketplaceOptions {
  apiBaseUrl?: string;
  webBaseUrl?: string;
  timeout?: number;
  limit?: number;
  maxRetries?: number;
  userAgent?: string;
  publishEndpoint?: string;
  fetchImpl?: FetchLike;
}

type ResolvedSkillMarketplaceOptions = {
  apiBaseUrl: string;
  webBaseUrl: string;
  timeout: number;
  limit: number;
  maxRetries: number;
  userAgent: string;
  publishEndpoint: string | null;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const isNodeRuntime = (): boolean => {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
};

const unique = (values: Array<string | null | undefined>): string[] => {
  return Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]));
};

const summarizeMarkdown = (markdown?: string | null): string | null => {
  if (!markdown) return null;

  const stripped = markdown
    .replace(/^---[\s\S]*?\n---\n?/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[`>*_~-]/g, ' ')
    .replace(/\r/g, '')
    .trim();

  const paragraph = stripped
    .split(/\n\s*\n/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .find(Boolean);

  if (!paragraph) return null;
  return paragraph.length <= 220 ? paragraph : `${paragraph.slice(0, 217).trimEnd()}...`;
};

const toFeaturedScore = (skill: RawMarketplaceSkill): number => {
  const rating = typeof skill.simple_score === 'number' ? skill.simple_score : 0;
  const stars = typeof skill.github_stars === 'number' ? skill.github_stars : 0;
  return rating * 100 + Math.log10(stars + 1);
};

const normalizeSkillIdentifier = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('skillhub:')) {
    return trimmed.slice('skillhub:'.length).trim();
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (['skillhub.lol', 'www.skillhub.lol', 'skillhub.club', 'www.skillhub.club'].includes(host)) {
      const segments = url.pathname.split('/').filter(Boolean);
      const skillIndex = segments.findIndex(segment => segment === 'skills');
      if (skillIndex >= 0 && segments[skillIndex + 1]) {
        return segments[skillIndex + 1];
      }
      return segments.at(-1) ?? trimmed;
    }
  } catch {
    // Ignore URL parse failures and treat the input as a raw slug.
  }

  return trimmed;
};

const validateManifest = (manifest: SkillManifest): string[] => {
  const issues: string[] = [];
  if (!manifest.id.trim()) issues.push('missing id');
  if (!manifest.name.trim()) issues.push('missing name');
  if (!manifest.version.trim()) issues.push('missing version');
  if (!manifest.entryFile.trim()) issues.push('missing entryFile');
  return issues;
};

export class SkillMarketplace {
  private readonly options: ResolvedSkillMarketplaceOptions;
  private readonly fetchImpl: FetchLike;

  constructor(options: SkillMarketplaceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.options = {
      apiBaseUrl: trimTrailingSlash(options.apiBaseUrl ?? DEFAULT_API_BASE),
      webBaseUrl: trimTrailingSlash(options.webBaseUrl ?? DEFAULT_WEB_BASE),
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      limit: options.limit ?? DEFAULT_LIMIT,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      userAgent: options.userAgent ?? 'Agora-SkillMarketplace/1.0',
      publishEndpoint: options.publishEndpoint?.trim() ? options.publishEndpoint.trim() : null,
    };
  }

  async search(query: string): Promise<SkillManifest[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.getFeatured();
    }

    try {
      const payload = await this.requestJson<MarketplaceListPayload>(`${this.options.apiBaseUrl}/desktop/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, limit: this.options.limit }),
      });
      return this.normalizeSkills(payload.skills);
    } catch (err) {
      console.error('[SkillMarketplace] search failed:', err);
      return [];
    }
  }

  async getFeatured(): Promise<SkillManifest[]> {
    try {
      const url = `${this.options.apiBaseUrl}/desktop/catalog?limit=${encodeURIComponent(String(this.options.limit))}&sortBy=score`;
      const payload = await this.requestJson<MarketplaceListPayload>(url);
      const skills = payload.skills ?? [];
      const featured = skills
        .filter(skill => (skill.simple_score ?? 0) >= 8 || (skill.github_stars ?? 0) >= 1000)
        .sort((a, b) => toFeaturedScore(b) - toFeaturedScore(a));
      const selected = (featured.length > 0 ? featured : skills).slice(0, this.options.limit);
      return this.normalizeSkills(selected);
    } catch (err) {
      console.error('[SkillMarketplace] getFeatured failed:', err);
      return [];
    }
  }

  async getDetails(id: string): Promise<SkillManifest> {
    const slug = normalizeSkillIdentifier(id);
    if (!slug) {
      throw new Error('Skill identifier is empty.');
    }

    try {
      const url = `${this.options.apiBaseUrl}/desktop/skills/${encodeURIComponent(slug)}`;
      const payload = await this.requestJson<MarketplaceDetailPayload>(url);
      const skill = this.normalizeSkill(payload.skill);
      if (!skill) {
        throw new Error(`Skill "${id}" not found in marketplace.`);
      }
      return skill;
    } catch (err) {
      console.error('[SkillMarketplace] getDetails failed:', err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async publish(manifest: SkillManifest): Promise<void> {
    const issues = validateManifest(manifest);
    if (issues.length > 0) {
      throw new Error(`Invalid skill manifest: ${issues.join(', ')}`);
    }

    if (!this.options.publishEndpoint) {
      throw new Error('Skill marketplace publish endpoint is not configured.');
    }

    try {
      await this.request(`${this.options.publishEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      });
    } catch (err) {
      console.error('[SkillMarketplace] publish failed:', err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private normalizeSkills(skills?: RawMarketplaceSkill[] | null): SkillManifest[] {
    return (skills ?? [])
      .map(skill => this.normalizeSkill(skill))
      .filter((skill): skill is SkillManifest => Boolean(skill));
  }

  private normalizeSkill(skill?: RawMarketplaceSkill | null): SkillManifest | null {
    const slug = normalizeSkillIdentifier(skill?.slug ?? '');
    if (!slug) return null;

    const description = skill?.description?.trim()
      || skill?.description_zh?.trim()
      || summarizeMarkdown(skill?.skill_md_raw)
      || skill?.repo_url?.trim()
      || skill?.name?.trim()
      || slug;
    const now = new Date().toISOString();

    return {
      id: slug,
      name: skill?.name?.trim() || slug,
      version: skill?.version?.trim() || '0.0.0',
      description,
      author: skill?.author?.trim() || 'SkillHub',
      tags: unique(['skillhub', skill?.category ?? '', ...(skill?.tags ?? [])]),
      entryFile: `skillhub:${slug}`,
      enabled: false,
      installedAt: now,
      updatedAt: now,
      source: 'marketplace',
    };
  }

  private async requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.request(url, init);
    const text = await response.text();
    if (!text.trim()) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeout);
      try {
        const headers = new Headers(init?.headers ?? {});
        if (!headers.has('Accept')) {
          headers.set('Accept', 'application/json');
        }
        if (isNodeRuntime() && !headers.has('User-Agent')) {
          headers.set('User-Agent', this.options.userAgent);
        }

        const response = await this.fetchImpl(url, {
          ...init,
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status >= 500 && attempt < this.options.maxRetries) {
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt >= this.options.maxRetries) {
          throw lastError;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error('Marketplace request failed.');
  }
}
