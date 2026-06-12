import { describe, expect, it } from 'vitest';

import { CoworkAgentEngine, DefaultCoworkAgentEngine } from '../shared/cowork/constants';
import {
  buildPresetAgentCreateRequest,
  resolvePresetAgentLocalizedFields,
} from './presetAgentsSupport';

const preset = {
  id: 'planner',
  name: '规划助手',
  nameEn: 'Planner',
  icon: '🧭',
  description: '中文描述',
  descriptionEn: 'English description',
  systemPrompt: '中文提示词',
  systemPromptEn: 'English system prompt',
  skillIds: ['web-search'],
};

describe('presetAgentsSupport', () => {
  it('resolves localized fields by language and falls back to Chinese text', () => {
    expect(resolvePresetAgentLocalizedFields(preset, 'zh')).toEqual({
      name: '规划助手',
      description: '中文描述',
      systemPrompt: '中文提示词',
    });
    expect(resolvePresetAgentLocalizedFields(preset, 'en')).toEqual({
      name: 'Planner',
      description: 'English description',
      systemPrompt: 'English system prompt',
    });
    expect(
      resolvePresetAgentLocalizedFields(
        {
          ...preset,
          nameEn: '',
          descriptionEn: '',
          systemPromptEn: '',
        },
        'en',
      ),
    ).toEqual({
      name: '规划助手',
      description: '中文描述',
      systemPrompt: '中文提示词',
    });
  });

  it('builds create-agent requests with a default engine and preserves explicit engines', () => {
    expect(buildPresetAgentCreateRequest(preset, 'zh')).toMatchObject({
      id: 'planner',
      name: '规划助手',
      description: '中文描述',
      systemPrompt: '中文提示词',
      icon: '🧭',
      skillIds: ['web-search'],
      agentEngine: DefaultCoworkAgentEngine,
      source: 'preset',
      presetId: 'planner',
    });
    expect(
      buildPresetAgentCreateRequest(
        {
          ...preset,
          agentEngine: CoworkAgentEngine.Codex,
        },
        'en',
      ),
    ).toMatchObject({
      name: 'Planner',
      description: 'English description',
      systemPrompt: 'English system prompt',
      agentEngine: CoworkAgentEngine.Codex,
    });
  });
});
