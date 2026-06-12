import {
  type CoworkAgentEngine,
  DefaultCoworkAgentEngine,
} from '../shared/cowork/constants';
import type { CreateAgentRequest } from './coworkStore';
import type { LanguageType } from './i18nSupport';

export interface PresetAgentLike {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  descriptionEn: string;
  systemPrompt: string;
  systemPromptEn: string;
  skillIds: string[];
  agentEngine?: CoworkAgentEngine;
}

export function resolvePresetAgentLocalizedFields(
  preset: PresetAgentLike,
  language: LanguageType,
): Pick<CreateAgentRequest, 'name' | 'description' | 'systemPrompt'> {
  const isEn = language === 'en';

  return {
    name: isEn && preset.nameEn ? preset.nameEn : preset.name,
    description:
      isEn && preset.descriptionEn ? preset.descriptionEn : preset.description,
    systemPrompt:
      isEn && preset.systemPromptEn
        ? preset.systemPromptEn
        : preset.systemPrompt,
  };
}

export function buildPresetAgentCreateRequest(
  preset: PresetAgentLike,
  language: LanguageType,
): CreateAgentRequest {
  const localizedFields = resolvePresetAgentLocalizedFields(preset, language);

  return {
    id: preset.id,
    ...localizedFields,
    icon: preset.icon,
    skillIds: preset.skillIds,
    agentEngine: preset.agentEngine || DefaultCoworkAgentEngine,
    source: 'preset',
    presetId: preset.id,
  };
}
