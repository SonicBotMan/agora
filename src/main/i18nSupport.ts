export type LanguageType = 'zh' | 'en';

export type TranslationParams = Record<string, string | number>;

export type TranslationCatalog = Record<LanguageType, Record<string, string>>;

export function normalizeMainLanguage(
  language: string | null | undefined,
): LanguageType {
  return language === 'en' ? 'en' : 'zh';
}

export function getFallbackMainLanguage(language: LanguageType): LanguageType {
  return language === 'zh' ? 'en' : 'zh';
}

export function interpolateTranslation(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) {
    return template;
  }

  let next = template;
  for (const [key, value] of Object.entries(params)) {
    next = next.split(`{${key}}`).join(String(value));
  }
  return next;
}

export function translateCatalog(
  catalog: TranslationCatalog,
  language: LanguageType,
  key: string,
  params?: TranslationParams,
): string {
  const template = catalog[language][key]
    ?? catalog[getFallbackMainLanguage(language)][key]
    ?? key;

  return interpolateTranslation(template, params);
}
