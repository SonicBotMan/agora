/**
 * EntityExtractor — named entity recognition and relation linking.
 *
 * Extracts entities (people, organisations, concepts, tools, technologies)
 * from text and links them by detected relationships.
 */

import type { Entity, EntityType, EntityRelation } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EntityExtractorOptions {
  /** Minimum confidence threshold (0-1) for including an extracted entity. */
  minConfidence?: number;
}

export interface ExtractedEntity extends Entity {
  confidence: number;
}

// ── Simple Pattern-Based Extractor ──────────────────────────────────────────

/**
 * Basic entity extractor using pattern matching.
 *
 * This is a skeleton implementation. In production, replace with:
 * - spaCy / NLP.js / Compromise for proper NER
 * - LLM-based extraction for higher accuracy
 * - Knowledge graph lookups for relation linking
 */
export class EntityExtractor {
  private options: Required<EntityExtractorOptions>;

  constructor(options: EntityExtractorOptions = {}) {
    this.options = {
      minConfidence: options.minConfidence ?? 0.3,
    };
  }

  /**
   * Extract entities from the given text.
   *
   * @param text - The source text to analyse.
   * @returns Array of extracted entities with relations.
   */
  async extract(text: string): Promise<Entity[]> {
    const entities = new Map<string, ExtractedEntity>();

    // Run extraction passes
    this.extractPeople(text, entities);
    this.extractOrganisations(text, entities);
    this.extractConcepts(text, entities);
    this.extractTools(text, entities);
    this.extractTechnologies(text, entities);

    // Link entities by co-occurrence proximity
    this.linkEntities(text, entities);

    // Filter by confidence threshold
    return Array.from(entities.values())
      .filter((e) => e.confidence >= this.options.minConfidence)
      .map((e) => ({
        name: e.name,
        type: e.type,
        relations: e.relations,
      }));
  }

  /**
   * Extract entities from multiple documents.
   */
  async extractBatch(texts: string[]): Promise<Entity[][]> {
    return Promise.all(texts.map((t) => this.extract(t)));
  }

  // ── Extraction Passes ──────────────────────────────────────────────────

  private extractPeople(text: string, entities: Map<string, ExtractedEntity>): void {
    // Match common name patterns: "John Smith", "Dr. Jane Doe"
    const personRegex = /(?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)?\s*[A-Z][a-z]+\s[A-Z][a-z]+/g;
    const matches = text.match(personRegex);

    if (matches) {
      for (const name of [...new Set(matches)]) {
        this.addEntity(entities, {
          name: name.trim(),
          type: 'person' as EntityType,
          relations: [],
          confidence: 0.5,
        });
      }
    }
  }

  private extractOrganisations(text: string, entities: Map<string, ExtractedEntity>): void {
    // Match org patterns: "Acme Corp", "Google", "Microsoft"
    const orgRegex = /[A-Z][a-z]+(?:\s(?:Corp|Inc|LLC|Ltd|Company|Group|Organization|Association|University|Institute))?/g;
    const matches = text.match(orgRegex);

    if (matches) {
      for (const name of [...new Set(matches)]) {
        if (name.length < 3) continue;
        this.addEntity(entities, {
          name: name.trim(),
          type: 'org' as EntityType,
          relations: [],
          confidence: 0.4,
        });
      }
    }
  }

  private extractConcepts(text: string, entities: Map<string, ExtractedEntity>): void {
    // Match abstract concept references
    const conceptPatterns = [
      /\b(artificial intelligence|machine learning|deep learning|reinforcement learning)\b/gi,
      /\b(computer vision|natural language processing|information retrieval)\b/gi,
      /\b(knowledge graph|semantic web|ontology|taxonomy)\b/gi,
    ];

    for (const pattern of conceptPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const name of [...new Set(matches)]) {
          this.addEntity(entities, {
            name,
            type: 'concept' as EntityType,
            relations: [],
            confidence: 0.6,
          });
        }
      }
    }
  }

  private extractTools(text: string, entities: Map<string, ExtractedEntity>): void {
    // Match tool names (capitalised words followed by "tool", "library", "framework")
    const toolRegex = /\b([A-Z][a-zA-Z0-9]+)\s+(?:tool|library|framework|sdk|api|platform|editor|plugin)\b/g;
    const matches = text.match(toolRegex);

    if (matches) {
      for (const match of [...new Set(matches)]) {
        const name = match.split(/\s+/)[0];
        this.addEntity(entities, {
          name,
          type: 'tool' as EntityType,
          relations: [],
          confidence: 0.5,
        });
      }
    }
  }

  private extractTechnologies(text: string, entities: Map<string, ExtractedEntity>): void {
    // Match tech names: "TypeScript", "Python", "React", "Node.js", "Docker"
    const techRegex = /\b(TypeScript|JavaScript|Python|Rust|Go|Java|C\+\+|C#|Ruby|Swift|Kotlin)\b/g;
    const matches = text.match(techRegex);

    if (matches) {
      for (const name of [...new Set(matches)]) {
        this.addEntity(entities, {
          name,
          type: 'tech' as EntityType,
          relations: [],
          confidence: 0.7,
        });
      }
    }
  }

  // ── Relation Linking ───────────────────────────────────────────────────

  /**
   * Link entities by co-occurrence within a sliding window of words.
   */
  private linkEntities(text: string, entities: Map<string, ExtractedEntity>): void {
    const words = text.split(/\s+/);
    const windowSize = 30;
    const entityList = Array.from(entities.values());

    for (let i = 0; i < entityList.length; i++) {
      for (let j = i + 1; j < entityList.length; j++) {
        const a = entityList[i];
        const b = entityList[j];

        // Check if they co-occur within the window
        if (this.coOccurs(words, a.name, b.name, windowSize)) {
          // Add bidirectional relation
          const relationType = this.inferRelationType(a.type, b.type);
          this.addRelation(entities, a.name, { target: b.name, type: relationType });
          this.addRelation(entities, b.name, { target: a.name, type: relationType });
        }
      }
    }
  }

  private coOccurs(words: string[], nameA: string, nameB: string, window: number): boolean {
    const tokensA = nameA.toLowerCase().split(/\s+/);
    const tokensB = nameB.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      if (this.matchesAt(words, i, tokensA)) {
        // Check if B appears within the window after A
        for (let j = i; j < Math.min(i + window, words.length); j++) {
          if (this.matchesAt(words, j, tokensB) && j !== i) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private matchesAt(words: string[], pos: number, tokens: string[]): boolean {
    for (let k = 0; k < tokens.length; k++) {
      if (pos + k >= words.length) return false;
      if (words[pos + k].toLowerCase().replace(/[^a-z0-9]/g, '') !== tokens[k].replace(/[^a-z0-9]/g, '')) {
        return false;
      }
    }
    return true;
  }

  private inferRelationType(typeA: EntityType, typeB: EntityType): string {
    if (typeA === 'person' && typeB === 'org') return 'works_at';
    if (typeA === 'org' && typeB === 'person') return 'employs';
    if (typeA === 'tool' && typeB === 'tech') return 'built_with';
    if (typeA === 'tech' && typeB === 'tool') return 'uses';
    if (typeA === 'concept' && typeB === 'tech') return 'implemented_by';
    if (typeA === 'tech' && typeB === 'concept') return 'implements';
    return 'related_to';
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private addEntity(entities: Map<string, ExtractedEntity>, entity: ExtractedEntity): void {
    const existing = entities.get(entity.name);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, entity.confidence);
    } else {
      entities.set(entity.name, { ...entity });
    }
  }

  private addRelation(
    entities: Map<string, ExtractedEntity>,
    name: string,
    relation: EntityRelation
  ): void {
    const entity = entities.get(name);
    if (entity && !entity.relations.some((r) => r.target === relation.target)) {
      entity.relations.push(relation);
    }
  }
}
