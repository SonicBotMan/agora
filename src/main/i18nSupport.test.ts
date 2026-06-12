import { describe, expect, it } from 'vitest';

import {
  getFallbackMainLanguage,
  interpolateTranslation,
  normalizeMainLanguage,
  translateCatalog,
  type TranslationCatalog,
} from './i18nSupport';

const catalog: TranslationCatalog = {
  zh: {
    hello: '你好，{name}！你好，{name}！',
  },
  en: {
    hello: 'Hello, {name}! Hello, {name}!',
    fallbackOnly: 'Fallback only',
  },
};

describe('i18nSupport', () => {
  it('normalizes unsupported languages to zh', () => {
    expect(normalizeMainLanguage('en')).toBe('en');
    expect(normalizeMainLanguage('zh')).toBe('zh');
    expect(normalizeMainLanguage('fr')).toBe('zh');
    expect(normalizeMainLanguage(undefined)).toBe('zh');
  });

  it('resolves the sibling fallback language', () => {
    expect(getFallbackMainLanguage('zh')).toBe('en');
    expect(getFallbackMainLanguage('en')).toBe('zh');
  });

  it('interpolates repeated placeholders and keeps unknown placeholders intact', () => {
    expect(
      interpolateTranslation('Hello, {name}! Hello again, {name}! {missing}', {
        name: 'Agora',
      }),
    ).toBe('Hello, Agora! Hello again, Agora! {missing}');
  });

  it('translates from the active language, falls back, and returns the key when missing', () => {
    expect(translateCatalog(catalog, 'zh', 'hello', { name: 'Agora' })).toBe(
      '你好，Agora！你好，Agora！',
    );
    expect(translateCatalog(catalog, 'zh', 'fallbackOnly')).toBe(
      'Fallback only',
    );
    expect(translateCatalog(catalog, 'en', 'unknown-key')).toBe('unknown-key');
  });
});
