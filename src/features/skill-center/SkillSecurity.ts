import { existsSync, readFileSync, statSync } from 'fs';

import { SkillManifest, SkillSecurityReport } from './types';

const SENSITIVE_API_PATTERNS = [
  /child_process\.(exec|execSync|spawn|spawnSync|fork)/,
  /\bimport\s*\{[^}]*\b(exec|execSync|spawn|spawnSync|fork)\b[^}]*\}\s*from\s*['"]child_process['"]/,
  /process\.(env|binding|dlopen)/,
  /require\(['"]electron['"]\)/,
  /remote\.(app|BrowserWindow|dialog|getCurrentWindow)/,
  /NodeGyp|node-gyp/,
];

const FILESYSTEM_ACCESS_PATTERNS = [
  /fs\.(readFileSync|writeFileSync|unlinkSync|rmSync|mkdirSync|readdirSync)/,
  /fs\.promises\.(readFile|writeFile|unlink|rm|mkdir|readdir)/,
];

const NETWORK_REQUEST_PATTERNS = [
  /fetch\(/,
  /axios\.(get|post|put|delete|patch)/,
  /XMLHttpRequest/,
  /WebSocket/,
  /net\.(connect|createConnection)/,
  /http\.(get|request)/,
  /https\.(get|request)/,
];

function scanSourceForPatterns(
  source: string,
  patterns: RegExp[]
): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) {
      found.push(`匹配到敏感模式: ${match[0]}`);
    }
  }
  return found;
}

function isRemoteSkillEntry(entryFile: string): boolean {
  return /^(?:skillhub:|https?:\/\/)/i.test(entryFile);
}

function readSkillSource(entryFile: string): string | null {
  if (!entryFile || isRemoteSkillEntry(entryFile) || !existsSync(entryFile)) {
    return null;
  }

  try {
    const stat = statSync(entryFile);
    if (!stat.isFile()) return null;
    return readFileSync(entryFile, 'utf-8');
  } catch {
    return null;
  }
}

export class SkillSecurity {
  scanSkill(manifest: SkillManifest): SkillSecurityReport {
    const issues: string[] = [];

    // In a full implementation we would load and scan the skill's source code.
    // For now we perform basic manifest-level checks.

    if (!manifest.id) {
      issues.push('Skill ID 为空');
    }

    if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      issues.push('版本号格式无效，应为 semver 格式 (x.y.z)');
    }

    if (!manifest.entryFile) {
      issues.push('缺少入口文件 (entryFile)');
    }

    if (manifest.source === 'marketplace' && !manifest.author) {
      issues.push('市场来源的 Skill 缺少作者信息');
    }

    const sourceCode = readSkillSource(manifest.entryFile);
    if (sourceCode) {
      issues.push(...scanSourceForPatterns(sourceCode, SENSITIVE_API_PATTERNS).map(
        s => `[敏感 API] ${s}`
      ));
      issues.push(...scanSourceForPatterns(sourceCode, FILESYSTEM_ACCESS_PATTERNS).map(
        s => `[文件系统] ${s}`
      ));
      issues.push(...scanSourceForPatterns(sourceCode, NETWORK_REQUEST_PATTERNS).map(
        s => `[网络请求] ${s}`
      ));
    } else if (manifest.entryFile) {
      issues.push(
        isRemoteSkillEntry(manifest.entryFile)
          ? '无法直接读取远程 Skill 源码，请在安装后重新扫描'
          : '无法读取 Skill 入口文件，请确认 entryFile 存在且可访问'
      );
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }
}
