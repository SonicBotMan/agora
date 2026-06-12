/**
 * Skill Services Manager - Manages background services for skills
 */

import { execSync, spawn, spawnSync } from 'child_process';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

import { cpRecursiveSync } from './fsCompat';
import { getElectronNodeRuntimePath } from './libs/coworkUtil';
import { appendPythonRuntimeToEnv } from './libs/pythonRuntime';
import {
  buildSkillServiceEnv,
  hasCommand,
  isWebSearchDistOutdated,
  isWebSearchRuntimeHealthy,
  resolveBundledWebSearchRepairPath,
  resolveNodeRuntime,
  resolveUserShellPath,
  resolveWebSearchPath,
} from './skillServicesSupport';

export class SkillServiceManager {
  private webSearchPid: number | null = null;
  private skillEnv: Record<string, string | undefined> | null = null;

  private repairWebSearchRuntimeFromBundled(skillPath: string): void {
    const bundledPath = resolveBundledWebSearchRepairPath({
      skillPath,
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
      existsSync: fs.existsSync,
    });
    if (!bundledPath) {
      return;
    }

    try {
      cpRecursiveSync(bundledPath, skillPath, {
        force: true,
      });
      console.log('[SkillServices] Repaired web-search runtime from bundled resources');
    } catch (error) {
      console.warn('[SkillServices] Failed to repair web-search runtime from bundled resources:', error);
    }
  }

  private ensureWebSearchRuntimeReady(skillPath: string): void {
    if (isWebSearchRuntimeHealthy(skillPath, fs)) {
      return;
    }

    this.repairWebSearchRuntimeFromBundled(skillPath);
    if (isWebSearchRuntimeHealthy(skillPath, fs)) {
      return;
    }

    const nodeModules = path.join(skillPath, 'node_modules');
    const distDir = path.join(skillPath, 'dist');
    const env = this.skillEnv as NodeJS.ProcessEnv ?? process.env;
    const npmAvailable = hasCommand({
      command: 'npm',
      env,
      platform: process.platform,
      spawnSync,
    });

    const shouldInstallDeps =
      !fs.existsSync(nodeModules)
      || !isWebSearchRuntimeHealthy(skillPath, fs);
    if (shouldInstallDeps) {
      if (!npmAvailable) {
        throw new Error('Web-search runtime is incomplete and npm is not available to repair it');
      }
      console.log('[SkillServices] Installing/reparing web-search dependencies...');
      execSync('npm install', { cwd: skillPath, stdio: 'ignore', env });
    }

    const shouldCompileDist =
      !fs.existsSync(distDir)
      || isWebSearchDistOutdated(skillPath, fs);
    if (shouldCompileDist) {
      if (!npmAvailable) {
        throw new Error('Web-search dist files are missing/outdated and npm is not available to rebuild them');
      }
      console.log('[SkillServices] Compiling web-search TypeScript...');
      execSync('npm run build', { cwd: skillPath, stdio: 'ignore', env });
    }

    if (!isWebSearchRuntimeHealthy(skillPath, fs)) {
      throw new Error('Web-search runtime is still unhealthy after attempted repair');
    }
  }

  /**
   * Start all skill services
   */
  async startAll(): Promise<void> {
    console.log('[SkillServices] Starting skill services...');

    // Resolve environment once for all service spawns
    this.skillEnv = buildSkillServiceEnv({
      processEnv: process.env,
      isPackaged: app.isPackaged,
      homePath: app.getPath('home'),
      resolveUserShellPath: () =>
        resolveUserShellPath({
          platform: process.platform,
          shell: process.env.SHELL,
          env: process.env,
          execSync,
        }),
      electronNodeRuntimePath: getElectronNodeRuntimePath(),
      appendPythonRuntimeToEnv,
    });

    try {
      await this.startWebSearchService();
    } catch (error) {
      console.error('[SkillServices] Error starting services:', error);
    }
  }

  /**
   * Stop all skill services
   */
  async stopAll(): Promise<void> {
    console.log('[SkillServices] Stopping skill services...');

    try {
      await this.stopWebSearchService();
    } catch (error) {
      console.error('[SkillServices] Error stopping services:', error);
    }
  }

  /**
   * Start Web Search Bridge Server
   */
  async startWebSearchService(): Promise<void> {
    try {
      const skillPath = this.getWebSearchPath();
      if (!skillPath) {
        console.log('[SkillServices] Web Search skill not found, skipping');
        return;
      }

      // Check if already running
      if (this.isWebSearchServiceRunning()) {
        console.log('[SkillServices] Web Search service already running');
        return;
      }

      console.log('[SkillServices] Starting Web Search Bridge Server...');

      await this.startWebSearchServiceProcess(skillPath);

      // Wait a moment for the server to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if server started successfully
      const pidFile = path.join(skillPath, '.server.pid');
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
        this.webSearchPid = pid;
        console.log(`[SkillServices] Web Search Bridge Server started (PID: ${pid})`);
      } else {
        console.warn('[SkillServices] Web Search Bridge Server may not have started correctly');
      }
    } catch (error) {
      console.error('[SkillServices] Failed to start Web Search service:', error);
    }
  }

  private async startWebSearchServiceProcess(skillPath: string): Promise<void> {
    const pidFile = path.join(skillPath, '.server.pid');
    const logFile = path.join(skillPath, '.server.log');
    const serverEntry = path.join(skillPath, 'dist', 'server', 'index.js');
    this.ensureWebSearchRuntimeReady(skillPath);
    const baseEnv = this.skillEnv as NodeJS.ProcessEnv ?? process.env;
    const runtime = resolveNodeRuntime({
      env: baseEnv,
      hasCommand: (command, resolvedEnv) =>
        hasCommand({
          command,
          env: resolvedEnv,
          platform: process.platform,
          spawnSync,
        }),
      electronNodeRuntimePath: getElectronNodeRuntimePath(),
    });
    const electronNodeRuntimePath = getElectronNodeRuntimePath();
    const env = {
      ...baseEnv,
      ...(runtime.extraEnv ?? {}),
      LOBSTERAI_ELECTRON_PATH: electronNodeRuntimePath,
    };

    // Node/Electron validates stdio streams synchronously. Use fd to avoid
    // races where createWriteStream has not opened the file descriptor yet.
    const logFd = fs.openSync(logFile, 'a');
    let child;
    try {
      child = spawn(runtime.command, [...runtime.args, serverEntry], {
        cwd: skillPath,
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env,
        windowsHide: process.platform === 'win32',
      });
    } finally {
      fs.closeSync(logFd);
    }

    fs.writeFileSync(pidFile, child.pid!.toString());
    child.unref();

    const runtimeLabel = runtime.command === 'node' ? 'node' : 'electron-node';
    console.log(`[SkillServices] Web Search Bridge Server starting (PID: ${child.pid}, runtime: ${runtimeLabel})`);
    console.log(`[SkillServices] Logs: ${logFile}`);
  }

  /**
   * Stop Web Search Bridge Server
   */
  async stopWebSearchService(): Promise<void> {
    try {
      const skillPath = this.getWebSearchPath();
      if (!skillPath) {
        return;
      }

      if (!this.isWebSearchServiceRunning()) {
        console.log('[SkillServices] Web Search service not running');
        return;
      }

      console.log('[SkillServices] Stopping Web Search Bridge Server...');

      if (this.webSearchPid) {
        try {
          process.kill(this.webSearchPid, 'SIGTERM');
        } catch (error) {
          console.warn('[SkillServices] Failed to kill process:', error);
        }
      }

      const pidFile = path.join(skillPath, '.server.pid');
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }

      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('[SkillServices] Web Search Bridge Server stopped');
      this.webSearchPid = null;
    } catch (error) {
      console.error('[SkillServices] Failed to stop Web Search service:', error);
    }
  }

  /**
   * Check if Web Search service is running
   */
  isWebSearchServiceRunning(): boolean {
    if (this.webSearchPid === null) {
      // Try to read PID from file
      const skillPath = this.getWebSearchPath();
      if (!skillPath) {
        return false;
      }

      const pidFile = path.join(skillPath, '.server.pid');
      if (fs.existsSync(pidFile)) {
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
          this.webSearchPid = pid;
        } catch {
          return false;
        }
      } else {
        return false;
      }
    }

    // Check if process is actually running
    try {
      process.kill(this.webSearchPid, 0); // Signal 0 checks if process exists
      return true;
    } catch {
      this.webSearchPid = null;
      return false;
    }
  }

  /**
   * Get Web Search skill path
   */
  private getWebSearchPath(): string | null {
    return resolveWebSearchPath({
      isPackaged: app.isPackaged,
      userDataPath: app.getPath('userData'),
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
      moduleDir: __dirname,
      existsSync: fs.existsSync,
    });
  }

  /**
   * Get service status
   */
  getStatus(): { webSearch: boolean } {
    return {
      webSearch: this.isWebSearchServiceRunning()
    };
  }

  /**
   * Health check for Web Search service
   */
  async checkWebSearchHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8923/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let serviceManager: SkillServiceManager | null = null;

export function getSkillServiceManager(): SkillServiceManager {
  if (!serviceManager) {
    serviceManager = new SkillServiceManager();
  }
  return serviceManager;
}
