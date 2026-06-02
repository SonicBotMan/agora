import { SkillManifest, SkillSecurityReport } from './types';

const SENSITIVE_API_PATTERNS = [
  /child_process\.(exec|execSync|spawn|spawnSync|fork)/,
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

    // Skeleton: real scanning would also check source code patterns
    // const sourceCode = readSkillSource(manifest.entryFile);
    // issues.push(...scanSourceForPatterns(sourceCode, SENSITIVE_API_PATTERNS).map(
    //   s => `[敏感 API] ${s}`
    // ));
    // issues.push(...scanSourceForPatterns(sourceCode, FILESYSTEM_ACCESS_PATTERNS).map(
    //   s => `[文件系统] ${s}`
    // ));
    // issues.push(...scanSourceForPatterns(sourceCode, NETWORK_REQUEST_PATTERNS).map(
    //   s => `[网络请求] ${s}`
    // ));

    return {
      safe: issues.length === 0,
      issues,
    };
  }
}
