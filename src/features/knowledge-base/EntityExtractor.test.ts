import { describe, expect, it } from 'vitest';

import { EntityExtractor } from './EntityExtractor';

const findEntity = (entities: Awaited<ReturnType<EntityExtractor['extract']>>, name: string) => {
  return entities.find(entity => entity.name === name);
};

describe('EntityExtractor', () => {
  it('extracts agora-domain entities and links them with contextual relations', async () => {
    const extractor = new EntityExtractor();
    const entities = await extractor.extract(
      'Alice Johnson at OpenAI uses OpenCode with TypeScript and React for retrieval augmented generation. Monaco Editor and xterm.js run inside Electron.',
    );

    expect(findEntity(entities, 'Alice Johnson')).toMatchObject({ type: 'person' });
    expect(findEntity(entities, 'OpenAI')).toMatchObject({ type: 'org' });
    expect(findEntity(entities, 'OpenCode')).toMatchObject({ type: 'tool' });
    expect(findEntity(entities, 'TypeScript')).toMatchObject({ type: 'tech' });
    expect(findEntity(entities, 'React')).toMatchObject({ type: 'tech' });
    expect(findEntity(entities, 'retrieval augmented generation')).toMatchObject({ type: 'concept' });
    expect(findEntity(entities, 'Monaco Editor')).toMatchObject({ type: 'tool' });
    expect(findEntity(entities, 'xterm.js')).toMatchObject({ type: 'tool' });
    expect(findEntity(entities, 'Electron')).toMatchObject({ type: 'tech' });

    expect(findEntity(entities, 'Alice Johnson')?.relations).toEqual(expect.arrayContaining([
      { target: 'OpenAI', type: 'works_at' },
    ]));
    expect(findEntity(entities, 'OpenCode')?.relations).toEqual(expect.arrayContaining([
      { target: 'TypeScript', type: 'built_with' },
    ]));
  });

  it('avoids common title-case false positives in technical prose', async () => {
    const extractor = new EntityExtractor();
    const entities = await extractor.extract(
      'Research Findings summarize delivery planning, release notes, and workflow status for the final review.',
    );

    expect(entities.filter(entity => entity.type === 'person')).toHaveLength(0);
    expect(entities.filter(entity => entity.type === 'org')).toHaveLength(0);
  });

  it('deduplicates aliases and repeats while preserving the strongest canonical form', async () => {
    const extractor = new EntityExtractor();
    const entities = await extractor.extract(
      'OpenCode and opencode both integrate with TypeScript. RAG workflows also rely on retrieval augmented generation.',
    );

    expect(entities.filter(entity => entity.name === 'OpenCode')).toHaveLength(1);
    expect(entities.filter(entity => entity.name === 'retrieval augmented generation')).toHaveLength(1);
  });
});
