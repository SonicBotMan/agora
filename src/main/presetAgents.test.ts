import { beforeEach, describe, expect, it } from 'vitest';

import { setLanguage } from './i18n';
import { PRESET_AGENTS, presetToCreateRequest } from './presetAgents';

describe('presetAgents', () => {
  beforeEach(() => {
    setLanguage('zh');
  });

  it('localizes preset agent requests from the active main-process language', () => {
    const preset = PRESET_AGENTS[0];
    expect(presetToCreateRequest(preset)).toMatchObject({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      systemPrompt: preset.systemPrompt,
      icon: preset.icon,
      skillIds: preset.skillIds,
      source: 'preset',
      presetId: preset.id,
    });

    setLanguage('en');

    expect(presetToCreateRequest(preset)).toMatchObject({
      id: preset.id,
      name: preset.nameEn,
      description: preset.descriptionEn,
      systemPrompt: preset.systemPromptEn,
    });
  });

  it('keeps preset agent ids and localized copy structurally valid', () => {
    const ids = PRESET_AGENTS.map((preset) => preset.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const preset of PRESET_AGENTS) {
      expect(preset.name.trim().length).toBeGreaterThan(0);
      expect(preset.nameEn.trim().length).toBeGreaterThan(0);
      expect(preset.description.trim().length).toBeGreaterThan(0);
      expect(preset.descriptionEn.trim().length).toBeGreaterThan(0);
      expect(preset.systemPrompt.trim().length).toBeGreaterThan(0);
      expect(preset.systemPromptEn.trim().length).toBeGreaterThan(0);
      expect(preset.skillIds.length).toBeGreaterThan(0);
      expect(new Set(preset.skillIds).size).toBe(preset.skillIds.length);
    }
  });
});
