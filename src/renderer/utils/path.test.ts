import { describe, expect, test } from 'vitest';

import {
  getCompactFolderName,
  joinPathSegments,
  sanitizePathSegment,
} from './path';

describe('path utils', () => {
  test('sanitizes ASCII project names into safe directory segments', () => {
    expect(sanitizePathSegment('Marketing Site')).toBe('marketing-site');
    expect(sanitizePathSegment('  api_console  ')).toBe('api_console');
  });

  test('falls back to a separator-safe segment when no ASCII slug exists', () => {
    expect(sanitizePathSegment('中文 项目')).toBe('中文 项目');
    expect(sanitizePathSegment('设计/系统')).toBe('设计-系统');
  });

  test('joins child paths using the parent separator style', () => {
    expect(joinPathSegments('/tmp/workspace/', 'demo-app')).toBe('/tmp/workspace/demo-app');
    expect(joinPathSegments('C:\\Workspaces\\Agora\\', 'demo-app')).toBe('C:\\Workspaces\\Agora\\demo-app');
  });

  test('extracts compact folder labels from nested paths', () => {
    expect(getCompactFolderName('/tmp/workspace/demo-app')).toBe('demo-app');
    expect(getCompactFolderName('C:\\Workspaces\\Agora\\demo-app')).toBe('demo-app');
  });
});
