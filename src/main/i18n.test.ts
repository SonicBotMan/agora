import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getLanguage,
  MAIN_I18N_TRANSLATIONS,
  setLanguage,
  t,
} from './i18n';

function collectTypeScriptFiles(dirPath: string): string[] {
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectTypeScriptFiles(nextPath);
    }
    if (
      !entry.name.endsWith('.ts')
      || entry.name.endsWith('.test.ts')
      || entry.name.endsWith('.d.ts')
    ) {
      return [];
    }
    return [nextPath];
  });
}

function collectUsedTranslationKeys(): string[] {
  const sourceRoot = path.resolve(process.cwd(), 'src/main');
  const keyPattern = /\bt\((['"])([^'"]+)\1/g;
  const keys = new Set<string>();

  for (const filePath of collectTypeScriptFiles(sourceRoot)) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match: RegExpExecArray | null = null;
    while ((match = keyPattern.exec(content))) {
      keys.add(match[2]);
    }
  }

  return [...keys].sort();
}

describe('i18n', () => {
  beforeEach(() => {
    setLanguage('zh');
  });

  it('stores the active language and translates keys with interpolation', () => {
    expect(getLanguage()).toBe('zh');
    expect(t('trayShowWindow')).toBe('打开 Agora');
    expect(
      t('imMissingCredentials', { fields: 'appId, appSecret' }),
    ).toBe('缺少必要配置项: appId, appSecret');

    setLanguage('en');

    expect(getLanguage()).toBe('en');
    expect(t('trayShowWindow')).toBe('Open Agora');
  });

  it('returns the key itself when no translation exists', () => {
    expect(t('missing.translation.key')).toBe('missing.translation.key');
  });

  it('keeps zh/en translations in sync and covers all used main-process keys', () => {
    const zhKeys = Object.keys(MAIN_I18N_TRANSLATIONS.zh).sort();
    const enKeys = Object.keys(MAIN_I18N_TRANSLATIONS.en).sort();
    const usedKeys = collectUsedTranslationKeys();

    expect(enKeys).toEqual(zhKeys);
    expect(
      usedKeys.filter((key) => !(key in MAIN_I18N_TRANSLATIONS.zh)),
    ).toEqual([]);
    expect(
      usedKeys.filter((key) => !(key in MAIN_I18N_TRANSLATIONS.en)),
    ).toEqual([]);
  });
});
