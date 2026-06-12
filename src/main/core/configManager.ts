import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  ClaudeCodePermissionMode,
  type ClaudeCodePermissionMode as ClaudeCodePermissionModeType,
  type CoworkAgentEngine,
  DeepSeekTuiPermissionMode,
  type DeepSeekTuiPermissionMode as DeepSeekTuiPermissionModeType,
  DefaultCoworkAgentEngine,
  ExternalAgentConfigSource,
  type ExternalAgentConfigSource as ExternalAgentConfigSourceType,
  isClaudeCodePermissionMode,
  isCoworkAgentEngine,
  isDeepSeekTuiPermissionMode,
  isExternalAgentConfigSource,
  isOpenCodePermissionMode,
  OpenCodePermissionMode,
  type OpenCodePermissionMode as OpenCodePermissionModeType,
} from '../../shared/cowork/constants';
import type { CoworkConfig, CoworkConfigUpdate } from '../coworkStoreTypes';
import { normalizeMainLanguage } from '../i18nSupport';
import type {
  CoworkMemoryGuardLevel,
} from '../libs/coworkMemoryExtractor';

const DEFAULT_MEMORY_ENABLED = true;
const DEFAULT_MEMORY_IMPLICIT_UPDATE_ENABLED = true;
const DEFAULT_MEMORY_LLM_JUDGE_ENABLED = false;
const DEFAULT_MEMORY_GUARD_LEVEL: CoworkMemoryGuardLevel = 'strict';
const DEFAULT_MEMORY_USER_MEMORIES_MAX_ITEMS = 12;
const DEFAULT_EXTERNAL_AGENT_CONFIG_SOURCE: ExternalAgentConfigSourceType = ExternalAgentConfigSource.AgoraModel;
const OPENCLAW_GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const HERMES_GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.hermes', 'config.yaml');
const DEFAULT_CLAUDE_CODE_PERMISSION_MODE: ClaudeCodePermissionModeType = ClaudeCodePermissionMode.BypassPermissions;
const DEFAULT_OPENCODE_PERMISSION_MODE: OpenCodePermissionModeType = OpenCodePermissionMode.Auto;
const DEFAULT_DEEPSEEK_TUI_PERMISSION_MODE: DeepSeekTuiPermissionModeType = DeepSeekTuiPermissionMode.Auto;
const MIN_MEMORY_USER_MEMORIES_MAX_ITEMS = 1;
const MAX_MEMORY_USER_MEMORIES_MAX_ITEMS = 60;

const CONFIG_KEYS = [
  'workingDirectory',
  'executionMode',
  'agentEngine',
  'openclawConfigSource',
  'claudeCodeConfigSource',
  'claudeCodePermissionMode',
  'codexConfigSource',
  'hermesConfigSource',
  'opencodeConfigSource',
  'opencodePermissionMode',
  'deepseekTuiConfigSource',
  'deepseekTuiPermissionMode',
  'memoryEnabled',
  'memoryImplicitUpdateEnabled',
  'memoryLlmJudgeEnabled',
  'memoryGuardLevel',
  'memoryUserMemoriesMaxItems',
] as const;

interface ConfigRow {
  key: string;
  value: string;
}

interface KvRow {
  value: string;
}

const getDefaultWorkingDirectory = (): string => {
  return path.join(os.homedir(), 'agora', 'project');
};

function normalizeMemoryGuardLevel(value: string | undefined): CoworkMemoryGuardLevel {
  if (value === 'strict' || value === 'standard' || value === 'relaxed') return value;
  return DEFAULT_MEMORY_GUARD_LEVEL;
}

function parseBooleanConfig(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function clampMemoryUserMemoriesMaxItems(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MEMORY_USER_MEMORIES_MAX_ITEMS;
  return Math.max(
    MIN_MEMORY_USER_MEMORIES_MAX_ITEMS,
    Math.min(MAX_MEMORY_USER_MEMORIES_MAX_ITEMS, Math.floor(value)),
  );
}

export function normalizeCoworkAgentEngineValue(value?: string | null): CoworkAgentEngine {
  if (isCoworkAgentEngine(value)) {
    return value;
  }
  return DefaultCoworkAgentEngine;
}

function normalizeExternalAgentConfigSource(value?: string | null): ExternalAgentConfigSourceType {
  if (isExternalAgentConfigSource(value)) {
    return value;
  }
  return DEFAULT_EXTERNAL_AGENT_CONFIG_SOURCE;
}

function normalizeHermesConfigSource(value?: string | null): ExternalAgentConfigSourceType {
  if (isExternalAgentConfigSource(value)) {
    return value;
  }
  return fs.existsSync(HERMES_GLOBAL_CONFIG_PATH)
    ? ExternalAgentConfigSource.LocalCli
    : ExternalAgentConfigSource.AgoraModel;
}

function normalizeOpenClawConfigSource(value?: string | null): ExternalAgentConfigSourceType {
  if (isExternalAgentConfigSource(value)) {
    return value;
  }
  return fs.existsSync(OPENCLAW_GLOBAL_CONFIG_PATH)
    ? ExternalAgentConfigSource.LocalCli
    : ExternalAgentConfigSource.AgoraModel;
}

function normalizeOpenCodePermissionMode(value?: string | null): OpenCodePermissionModeType {
  if (isOpenCodePermissionMode(value)) {
    return value;
  }
  return DEFAULT_OPENCODE_PERMISSION_MODE;
}

function normalizeClaudeCodePermissionMode(value?: string | null): ClaudeCodePermissionModeType {
  if (isClaudeCodePermissionMode(value)) {
    return value;
  }
  return DEFAULT_CLAUDE_CODE_PERMISSION_MODE;
}

function normalizeDeepSeekTuiPermissionMode(value?: string | null): DeepSeekTuiPermissionModeType {
  if (isDeepSeekTuiPermissionMode(value)) {
    return value;
  }
  return DEFAULT_DEEPSEEK_TUI_PERMISSION_MODE;
}

let cachedDefaultSystemPrompt: string | null = null;

function getDefaultSystemPrompt(): string {
  if (cachedDefaultSystemPrompt !== null) {
    return cachedDefaultSystemPrompt;
  }
  try {
    const promptPath = path.join(app.getAppPath(), 'resources', 'SYSTEM_PROMPT.md');
    cachedDefaultSystemPrompt = fs.readFileSync(promptPath, 'utf-8');
  } catch {
    cachedDefaultSystemPrompt = '';
  }
  return cachedDefaultSystemPrompt;
}

export class ConfigManager {
  constructor(private db: Database.Database) {}

  private getOne<T>(
    sql: string,
    params: (string | number | null)[] = [],
  ): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  private getAll<T>(
    sql: string,
    params: (string | number | null)[] = [],
  ): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  private writeConfigValue(key: string, value: string, updatedAt: number): void {
    this.db
      .prepare(
        `
      INSERT INTO cowork_config (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
      )
      .run(key, value, updatedAt);
  }

  getConfig(): CoworkConfig {
    const configRows = this.getAll<ConfigRow>(
      `SELECT key, value FROM cowork_config WHERE key IN (${CONFIG_KEYS.map(() => '?').join(', ')})`,
      [...CONFIG_KEYS],
    );
    const cfg = new Map(configRows.map((row) => [row.key, row.value]));

    return {
      workingDirectory: cfg.get('workingDirectory') || getDefaultWorkingDirectory(),
      systemPrompt: getDefaultSystemPrompt(),
      executionMode: 'local',
      agentEngine: normalizeCoworkAgentEngineValue(cfg.get('agentEngine')),
      openclawConfigSource: normalizeOpenClawConfigSource(cfg.get('openclawConfigSource')),
      claudeCodeConfigSource: normalizeExternalAgentConfigSource(cfg.get('claudeCodeConfigSource')),
      claudeCodePermissionMode: normalizeClaudeCodePermissionMode(cfg.get('claudeCodePermissionMode')),
      codexConfigSource: normalizeExternalAgentConfigSource(cfg.get('codexConfigSource')),
      hermesConfigSource: normalizeHermesConfigSource(cfg.get('hermesConfigSource')),
      opencodeConfigSource: normalizeExternalAgentConfigSource(cfg.get('opencodeConfigSource')),
      opencodePermissionMode: normalizeOpenCodePermissionMode(cfg.get('opencodePermissionMode')),
      deepseekTuiConfigSource: normalizeExternalAgentConfigSource(cfg.get('deepseekTuiConfigSource')),
      deepseekTuiPermissionMode: normalizeDeepSeekTuiPermissionMode(cfg.get('deepseekTuiPermissionMode')),
      memoryEnabled: parseBooleanConfig(cfg.get('memoryEnabled'), DEFAULT_MEMORY_ENABLED),
      memoryImplicitUpdateEnabled: parseBooleanConfig(
        cfg.get('memoryImplicitUpdateEnabled'),
        DEFAULT_MEMORY_IMPLICIT_UPDATE_ENABLED,
      ),
      memoryLlmJudgeEnabled: parseBooleanConfig(
        cfg.get('memoryLlmJudgeEnabled'),
        DEFAULT_MEMORY_LLM_JUDGE_ENABLED,
      ),
      memoryGuardLevel: normalizeMemoryGuardLevel(cfg.get('memoryGuardLevel')),
      memoryUserMemoriesMaxItems: clampMemoryUserMemoriesMaxItems(
        Number(cfg.get('memoryUserMemoriesMaxItems')),
      ),
    };
  }

  setConfig(config: CoworkConfigUpdate): void {
    const now = Date.now();

    if (config.workingDirectory !== undefined) {
      this.writeConfigValue('workingDirectory', config.workingDirectory, now);
    }

    if (config.executionMode !== undefined) {
      this.writeConfigValue('executionMode', config.executionMode, now);
    }

    if (config.agentEngine !== undefined) {
      this.writeConfigValue(
        'agentEngine',
        normalizeCoworkAgentEngineValue(config.agentEngine),
        now,
      );
    }

    if (config.openclawConfigSource !== undefined) {
      this.writeConfigValue(
        'openclawConfigSource',
        normalizeExternalAgentConfigSource(config.openclawConfigSource),
        now,
      );
    }

    if (config.claudeCodeConfigSource !== undefined) {
      this.writeConfigValue(
        'claudeCodeConfigSource',
        normalizeExternalAgentConfigSource(config.claudeCodeConfigSource),
        now,
      );
    }

    if (config.claudeCodePermissionMode !== undefined) {
      this.writeConfigValue(
        'claudeCodePermissionMode',
        normalizeClaudeCodePermissionMode(config.claudeCodePermissionMode),
        now,
      );
    }

    if (config.codexConfigSource !== undefined) {
      this.writeConfigValue(
        'codexConfigSource',
        normalizeExternalAgentConfigSource(config.codexConfigSource),
        now,
      );
    }

    if (config.hermesConfigSource !== undefined) {
      this.writeConfigValue(
        'hermesConfigSource',
        normalizeExternalAgentConfigSource(config.hermesConfigSource),
        now,
      );
    }

    if (config.opencodeConfigSource !== undefined) {
      this.writeConfigValue(
        'opencodeConfigSource',
        normalizeExternalAgentConfigSource(config.opencodeConfigSource),
        now,
      );
    }

    if (config.opencodePermissionMode !== undefined) {
      this.writeConfigValue(
        'opencodePermissionMode',
        normalizeOpenCodePermissionMode(config.opencodePermissionMode),
        now,
      );
    }

    if (config.deepseekTuiConfigSource !== undefined) {
      this.writeConfigValue(
        'deepseekTuiConfigSource',
        normalizeExternalAgentConfigSource(config.deepseekTuiConfigSource),
        now,
      );
    }

    if (config.deepseekTuiPermissionMode !== undefined) {
      this.writeConfigValue(
        'deepseekTuiPermissionMode',
        normalizeDeepSeekTuiPermissionMode(config.deepseekTuiPermissionMode),
        now,
      );
    }

    if (config.memoryEnabled !== undefined) {
      this.writeConfigValue('memoryEnabled', config.memoryEnabled ? '1' : '0', now);
    }

    if (config.memoryImplicitUpdateEnabled !== undefined) {
      this.writeConfigValue(
        'memoryImplicitUpdateEnabled',
        config.memoryImplicitUpdateEnabled ? '1' : '0',
        now,
      );
    }

    if (config.memoryLlmJudgeEnabled !== undefined) {
      this.writeConfigValue(
        'memoryLlmJudgeEnabled',
        config.memoryLlmJudgeEnabled ? '1' : '0',
        now,
      );
    }

    if (config.memoryGuardLevel !== undefined) {
      this.writeConfigValue(
        'memoryGuardLevel',
        normalizeMemoryGuardLevel(config.memoryGuardLevel),
        now,
      );
    }

    if (config.memoryUserMemoriesMaxItems !== undefined) {
      this.writeConfigValue(
        'memoryUserMemoriesMaxItems',
        String(clampMemoryUserMemoriesMaxItems(config.memoryUserMemoriesMaxItems)),
        now,
      );
    }
  }

  getAppLanguage(): 'zh' | 'en' {
    const row = this.getOne<KvRow>('SELECT value FROM kv WHERE key = ?', ['app_config']);
    if (!row?.value) {
      return 'zh';
    }

    try {
      const config = JSON.parse(row.value) as { language?: string };
      return normalizeMainLanguage(config.language);
    } catch {
      return 'zh';
    }
  }
}
