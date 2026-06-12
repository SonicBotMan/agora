/**
 * EntityExtractor — deterministic local entity extraction and relation linking.
 *
 * The extractor is tuned for Agora's working domain: agent tooling, software
 * stacks, research workflows, and technical documents. It favors stable,
 * offline behavior over broad but noisy NER.
 */

import type { Entity, EntityRelation,EntityType } from './types';

export interface EntityExtractorOptions {
  /** Minimum confidence threshold (0-1) for including an extracted entity. */
  minConfidence?: number;
}

export interface ExtractedEntity extends Entity {
  confidence: number;
}

type EntityLexiconEntry = {
  name: string;
  type: EntityType;
  confidence: number;
  aliases?: string[];
};

type EntitySpan = {
  start: number;
  end: number;
  key: string;
};

const KNOWN_ENTITIES: EntityLexiconEntry[] = [
  { name: 'retrieval augmented generation', aliases: ['RAG'], type: 'concept', confidence: 0.95 },
  { name: 'natural language processing', aliases: ['NLP'], type: 'concept', confidence: 0.92 },
  { name: 'artificial intelligence', aliases: ['AI'], type: 'concept', confidence: 0.92 },
  { name: 'large language model', aliases: ['large language models', 'LLM', 'LLMs'], type: 'concept', confidence: 0.92 },
  { name: 'machine learning', type: 'concept', confidence: 0.9 },
  { name: 'deep learning', type: 'concept', confidence: 0.88 },
  { name: 'reinforcement learning', type: 'concept', confidence: 0.88 },
  { name: 'computer vision', type: 'concept', confidence: 0.86 },
  { name: 'information retrieval', type: 'concept', confidence: 0.84 },
  { name: 'knowledge graph', type: 'concept', confidence: 0.84 },
  { name: 'semantic web', type: 'concept', confidence: 0.82 },
  { name: 'ontology', type: 'concept', confidence: 0.8 },
  { name: 'taxonomy', type: 'concept', confidence: 0.8 },

  { name: 'Claude Code', type: 'tool', confidence: 0.97 },
  { name: 'DeepSeek-TUI', type: 'tool', confidence: 0.97 },
  { name: 'GitHub Copilot', type: 'tool', confidence: 0.95 },
  { name: 'Hermes Agent', aliases: ['Hermes'], type: 'tool', confidence: 0.93 },
  { name: 'Monaco Editor', aliases: ['Monaco'], type: 'tool', confidence: 0.92 },
  { name: 'Redux Toolkit', type: 'tech', confidence: 0.9 },
  { name: 'Tailwind CSS', type: 'tech', confidence: 0.9 },
  { name: 'Transformers.js', type: 'tool', confidence: 0.9 },
  { name: 'xterm.js', aliases: ['xterm'], type: 'tool', confidence: 0.9 },
  { name: 'JSON-RPC', type: 'tech', confidence: 0.88 },
  { name: 'Node.js', aliases: ['Node'], type: 'tech', confidence: 0.9 },
  { name: 'OpenClaw', type: 'tool', confidence: 0.97 },
  { name: 'OpenCode', type: 'tool', confidence: 0.97 },
  { name: 'Ollama', type: 'tool', confidence: 0.9 },
  { name: 'SkillHub', type: 'tool', confidence: 0.88 },
  { name: 'SQLite', type: 'tech', confidence: 0.9 },
  { name: 'TypeScript', type: 'tech', confidence: 0.94 },
  { name: 'WebSocket', type: 'tech', confidence: 0.86 },
  { name: 'Electron', type: 'tech', confidence: 0.92 },
  { name: 'Codex', type: 'tool', confidence: 0.95 },
  { name: 'React', type: 'tech', confidence: 0.92 },
  { name: 'Vite', type: 'tool', confidence: 0.84 },
  { name: 'FTS5', type: 'tech', confidence: 0.82 },
  { name: 'SSE', type: 'tech', confidence: 0.8 },
  { name: 'MCP', type: 'tech', confidence: 0.82 },
  { name: 'Rust', type: 'tech', confidence: 0.88 },
  { name: 'Python', type: 'tech', confidence: 0.88 },
  { name: 'Go', type: 'tech', confidence: 0.86 },
  { name: 'Java', type: 'tech', confidence: 0.86 },
  { name: 'C++', type: 'tech', confidence: 0.84 },
  { name: 'C#', type: 'tech', confidence: 0.84 },
  { name: 'Ruby', type: 'tech', confidence: 0.82 },
  { name: 'Swift', type: 'tech', confidence: 0.82 },
  { name: 'Kotlin', type: 'tech', confidence: 0.82 },
  { name: 'JavaScript', type: 'tech', confidence: 0.9 },

  { name: 'Alibaba Cloud', type: 'org', confidence: 0.88 },
  { name: 'Moonshot AI', type: 'org', confidence: 0.86 },
  { name: 'Microsoft', type: 'org', confidence: 0.88 },
  { name: 'Anthropic', type: 'org', confidence: 0.88 },
  { name: 'DeepSeek', type: 'org', confidence: 0.87 },
  { name: 'GitHub', type: 'org', confidence: 0.88 },
  { name: 'Google', type: 'org', confidence: 0.87 },
  { name: 'OpenAI', type: 'org', confidence: 0.9 },
  { name: 'Tencent', type: 'org', confidence: 0.84 },
  { name: 'Nous Research', type: 'org', confidence: 0.9 },
];

const PERSON_ROLE_BLOCKLIST = new Set([
  'Agent',
  'API',
  'Base',
  'CLI',
  'Code',
  'Concept',
  'Editor',
  'Engine',
  'Findings',
  'Framework',
  'Frontend',
  'Gateway',
  'Graph',
  'Knowledge',
  'Learning',
  'Library',
  'Model',
  'Platform',
  'Plugin',
  'Preview',
  'Project',
  'Release',
  'Report',
  'Research',
  'Runtime',
  'Search',
  'Skill',
  'Station',
  'Studio',
  'Topics',
  'Toolkit',
  'Workflow',
]);

const ORGANISATION_SUFFIX_REGEX =
  /\b([A-Z][\p{L}\p{N}&.+-]+(?:\s+[A-Z][\p{L}\p{N}&.+-]+){0,3}\s(?:Inc|Corp|Corporation|LLC|Ltd|Company|Group|Labs|Lab|Organization|Association|University|Institute|Foundation|Agency|Systems))\b/gu;
const TOOL_SUFFIX_REGEX =
  /\b([A-Z][\p{L}\p{N}.#+-]+(?:\s+[A-Z][\p{L}\p{N}.#+-]+){0,2}\s(?:CLI|SDK|API|Editor|Framework|Library|Plugin|Gateway|Runtime|Agent|Studio|Copilot))\b/gu;
const PERSON_REGEX =
  /\b(?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g;

const PERSON_ORG_HINTS = [' works at ', ' joined ', ' from ', ' at ', ' with '];
const TOOL_TECH_HINTS = [' built with ', ' powered by ', ' written in ', ' running on ', ' using ', ' uses ', ' with '];
const ORG_TOOL_HINTS = [' developed by ', ' maintained by ', ' released by ', ' from ', ' by '];
const CONCEPT_TECH_HINTS = [' implemented in ', ' implemented by ', ' powered by ', ' using ', ' with '];

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values));

const canonicalEntityKey = (value: string): string => value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isOverlapping = (start: number, end: number, spans: EntitySpan[]): boolean => {
  return spans.some(span => start < span.end && end > span.start);
};

const extractMatchRange = (match: RegExpExecArray): { start: number; end: number } | null => {
  if (typeof match.index !== 'number') return null;
  return {
    start: match.index,
    end: match.index + match[0].length,
  };
};

const sentenceSplitRegex = /(?<=[.!?])\s+|\n+/g;

export class EntityExtractor {
  private options: Required<EntityExtractorOptions>;

  constructor(options: EntityExtractorOptions = {}) {
    this.options = {
      minConfidence: options.minConfidence ?? 0.3,
    };
  }

  async extract(text: string): Promise<Entity[]> {
    const entities = new Map<string, ExtractedEntity>();
    const spans: EntitySpan[] = [];

    this.extractKnownEntities(text, entities, spans);
    this.extractOrganisations(text, entities, spans);
    this.extractTools(text, entities, spans);
    this.extractPeople(text, entities, spans);
    this.linkEntities(text, entities);

    return Array.from(entities.values())
      .filter(entity => entity.confidence >= this.options.minConfidence)
      .map(entity => ({
        name: entity.name,
        type: entity.type,
        relations: entity.relations,
      }));
  }

  async extractBatch(texts: string[]): Promise<Entity[][]> {
    return Promise.all(texts.map((text) => this.extract(text)));
  }

  private extractKnownEntities(
    text: string,
    entities: Map<string, ExtractedEntity>,
    spans: EntitySpan[],
  ): void {
    const lexicon = KNOWN_ENTITIES
      .flatMap(entry => [entry.name, ...(entry.aliases ?? [])].map(alias => ({
        alias,
        entry,
      })))
      .sort((left, right) => right.alias.length - left.alias.length);

    for (const { alias, entry } of lexicon) {
      const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`, 'giu');
      for (const match of text.matchAll(regex)) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        const key = canonicalEntityKey(entry.name);

        if (isOverlapping(start, end, spans) && spans.some(span => span.key === key)) {
          continue;
        }

        this.addEntity(entities, {
          name: entry.name,
          type: entry.type,
          relations: [],
          confidence: entry.confidence,
        });
        spans.push({ start, end, key });
      }
    }
  }

  private extractPeople(
    text: string,
    entities: Map<string, ExtractedEntity>,
    spans: EntitySpan[],
  ): void {
    const matches = text.matchAll(PERSON_REGEX);

    for (const match of matches) {
      const range = extractMatchRange(match);
      if (!range) continue;
      if (isOverlapping(range.start, range.end, spans)) continue;

      const rawName = match[0].trim().replace(/\s+/g, ' ');
      const name = rawName.replace(/^(?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/, '');
      const tokens = name.split(' ');

      if (tokens.length < 2 || tokens.length > 3) continue;
      if (tokens.some(token => PERSON_ROLE_BLOCKLIST.has(token))) continue;
      if (entities.has(canonicalEntityKey(name))) continue;

      this.addEntity(entities, {
        name,
        type: 'person',
        relations: [],
        confidence: rawName !== name ? 0.75 : 0.6,
      });
      spans.push({ ...range, key: canonicalEntityKey(name) });
    }
  }

  private extractOrganisations(
    text: string,
    entities: Map<string, ExtractedEntity>,
    spans: EntitySpan[],
  ): void {
    for (const match of text.matchAll(ORGANISATION_SUFFIX_REGEX)) {
      const range = extractMatchRange(match);
      if (!range) continue;
      if (isOverlapping(range.start, range.end, spans)) continue;

      const name = match[1]?.trim();
      if (!name) continue;

      this.addEntity(entities, {
        name,
        type: 'org',
        relations: [],
        confidence: 0.72,
      });
      spans.push({ ...range, key: canonicalEntityKey(name) });
    }
  }

  private extractTools(
    text: string,
    entities: Map<string, ExtractedEntity>,
    spans: EntitySpan[],
  ): void {
    for (const match of text.matchAll(TOOL_SUFFIX_REGEX)) {
      const range = extractMatchRange(match);
      if (!range) continue;
      if (isOverlapping(range.start, range.end, spans)) continue;

      const name = match[1]?.trim();
      if (!name) continue;

      this.addEntity(entities, {
        name,
        type: 'tool',
        relations: [],
        confidence: 0.74,
      });
      spans.push({ ...range, key: canonicalEntityKey(name) });
    }
  }

  private linkEntities(text: string, entities: Map<string, ExtractedEntity>): void {
    const entityList = Array.from(entities.values());
    const sentences = uniqueStrings(text.split(sentenceSplitRegex).map(sentence => sentence.trim()).filter(Boolean));

    for (const sentence of sentences) {
      const mentioned = entityList.filter(entity => this.containsEntityMention(sentence, entity.name));
      if (mentioned.length < 2) continue;

      for (let i = 0; i < mentioned.length; i += 1) {
        for (let j = i + 1; j < mentioned.length; j += 1) {
          const a = mentioned[i];
          const b = mentioned[j];

          const forward = this.inferSentenceRelation(sentence, a, b);
          const backward = this.inferSentenceRelation(sentence, b, a);

          if (forward) this.addRelation(entities, a.name, { target: b.name, type: forward });
          if (backward) this.addRelation(entities, b.name, { target: a.name, type: backward });
        }
      }
    }

    const words = text.split(/\s+/);
    const windowSize = 24;

    for (let i = 0; i < entityList.length; i += 1) {
      for (let j = i + 1; j < entityList.length; j += 1) {
        const a = entityList[i];
        const b = entityList[j];

        if (!this.coOccurs(words, a.name, b.name, windowSize)) continue;

        const relationType = this.inferFallbackRelationType(a.type, b.type);
        this.addRelation(entities, a.name, { target: b.name, type: relationType });
        this.addRelation(entities, b.name, {
          target: a.name,
          type: this.inferFallbackRelationType(b.type, a.type),
        });
      }
    }
  }

  private containsEntityMention(sentence: string, entityName: string): boolean {
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(entityName)}(?![\\p{L}\\p{N}])`, 'iu');
    return regex.test(sentence);
  }

  private coOccurs(words: string[], nameA: string, nameB: string, window: number): boolean {
    const tokensA = nameA.toLowerCase().split(/\s+/);
    const tokensB = nameB.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i += 1) {
      if (!this.matchesAt(words, i, tokensA)) continue;

      for (let j = i; j < Math.min(i + window, words.length); j += 1) {
        if (this.matchesAt(words, j, tokensB) && j !== i) {
          return true;
        }
      }
    }

    return false;
  }

  private matchesAt(words: string[], pos: number, tokens: string[]): boolean {
    for (let index = 0; index < tokens.length; index += 1) {
      if (pos + index >= words.length) return false;
      if (words[pos + index].toLowerCase().replace(/[^a-z0-9+#.-]/g, '') !== tokens[index].replace(/[^a-z0-9+#.-]/g, '')) {
        return false;
      }
    }
    return true;
  }

  private inferSentenceRelation(
    sentence: string,
    source: ExtractedEntity,
    target: ExtractedEntity,
  ): string | null {
    const lowerSentence = ` ${sentence.toLowerCase()} `;

    if (source.type === 'person' && target.type === 'org' && PERSON_ORG_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'works_at';
    }

    if (source.type === 'org' && target.type === 'person' && PERSON_ORG_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'employs';
    }

    if (source.type === 'org' && target.type === 'tool' && ORG_TOOL_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'develops';
    }

    if (source.type === 'tool' && target.type === 'org' && ORG_TOOL_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'maintained_by';
    }

    if (source.type === 'tool' && target.type === 'tech' && TOOL_TECH_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'built_with';
    }

    if (source.type === 'tech' && target.type === 'tool' && TOOL_TECH_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'powers';
    }

    if (source.type === 'concept' && target.type === 'tech' && CONCEPT_TECH_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'implemented_by';
    }

    if (source.type === 'tech' && target.type === 'concept' && CONCEPT_TECH_HINTS.some(hint => lowerSentence.includes(hint))) {
      return 'implements';
    }

    return null;
  }

  private inferFallbackRelationType(typeA: EntityType, typeB: EntityType): string {
    if (typeA === 'person' && typeB === 'org') return 'works_at';
    if (typeA === 'org' && typeB === 'person') return 'employs';
    if (typeA === 'tool' && typeB === 'tech') return 'built_with';
    if (typeA === 'tech' && typeB === 'tool') return 'powers';
    if (typeA === 'concept' && typeB === 'tech') return 'implemented_by';
    if (typeA === 'tech' && typeB === 'concept') return 'implements';
    if (typeA === 'org' && typeB === 'tool') return 'develops';
    if (typeA === 'tool' && typeB === 'org') return 'maintained_by';
    return 'related_to';
  }

  private addEntity(entities: Map<string, ExtractedEntity>, entity: ExtractedEntity): void {
    const key = canonicalEntityKey(entity.name);
    const existing = entities.get(key);

    if (existing) {
      if (entity.confidence > existing.confidence) {
        existing.name = entity.name;
        existing.type = entity.type;
      }
      existing.confidence = Math.max(existing.confidence, entity.confidence);
      return;
    }

    entities.set(key, { ...entity });
  }

  private addRelation(
    entities: Map<string, ExtractedEntity>,
    sourceName: string,
    relation: EntityRelation,
  ): void {
    const entity = entities.get(canonicalEntityKey(sourceName));
    if (!entity) return;

    if (!entity.relations.some(existing => existing.target === relation.target && existing.type === relation.type)) {
      entity.relations.push(relation);
    }
  }
}
