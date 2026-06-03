/**
 * Agora — MCP IPC Handlers
 *
 * Model-Context-Protocol server CRUD + marketplace fetch + bridge refresh.
 * Extracted from main.ts lines 3442–3543.
 */

import { ipcMain } from 'electron';
import https from 'https';

import type { McpStore, McpServerFormData } from '../mcpStore';

export interface McpDeps {
  getMcpStore: () => McpStore;
  refreshMcpBridge: () => Promise<{ tools: number; error?: string }>;
  getServerApiBaseUrl: () => string;
}

export function registerMcpHandlers(deps: McpDeps): void {
  ipcMain.handle('mcp:list', () => {
    try {
      const servers = deps.getMcpStore().listServers();
      return { success: true, servers };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list MCP servers' };
    }
  });

  ipcMain.handle('mcp:create', async (_event, data: McpServerFormData) => {
    try {
      deps.getMcpStore().createServer(data);
      const servers = deps.getMcpStore().listServers();
      // Trigger async MCP bridge refresh (don't await — let UI show DB result immediately)
      deps.refreshMcpBridge().catch(err => console.error('[McpBridge] background refresh error:', err));
      return { success: true, servers };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create MCP server' };
    }
  });

  ipcMain.handle('mcp:update', async (_event, id: string, data: Partial<McpServerFormData>) => {
    try {
      deps.getMcpStore().updateServer(id, data);
      const servers = deps.getMcpStore().listServers();
      deps.refreshMcpBridge().catch(err => console.error('[McpBridge] background refresh error:', err));
      return { success: true, servers };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update MCP server' };
    }
  });

  ipcMain.handle('mcp:delete', async (_event, id: string) => {
    try {
      deps.getMcpStore().deleteServer(id);
      const servers = deps.getMcpStore().listServers();
      deps.refreshMcpBridge().catch(err => console.error('[McpBridge] background refresh error:', err));
      return { success: true, servers };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete MCP server' };
    }
  });

  ipcMain.handle('mcp:setEnabled', async (_event, options: { id: string; enabled: boolean }) => {
    try {
      deps.getMcpStore().setEnabled(options.id, options.enabled);
      const servers = deps.getMcpStore().listServers();
      deps.refreshMcpBridge().catch(err => console.error('[McpBridge] background refresh error:', err));
      return { success: true, servers };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update MCP server' };
    }
  });

  ipcMain.handle('mcp:fetchMarketplace', async () => {
    const url = `${deps.getServerApiBaseUrl()}/api/mcp/marketplace`;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.get(url, { timeout: 10000 }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => { body += chunk; });
          res.on('end', () => resolve(body));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      });
      const json = JSON.parse(data);
      const value = json?.data?.value;
      if (!value) {
        return { success: false, error: 'Invalid response: missing data.value' };
      }
      const marketplace = typeof value === 'string' ? JSON.parse(value) : value;
      return { success: true, data: marketplace };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch marketplace' };
    }
  });

  // Explicit bridge refresh — renderer can await this for loading state
  ipcMain.handle('mcp:refreshBridge', async () => {
    try {
      const result = await deps.refreshMcpBridge();
      return { success: true, tools: result.tools, error: result.error };
    } catch (error) {
      return { success: false, tools: 0, error: error instanceof Error ? error.message : 'Failed to refresh MCP bridge' };
    }
  });
}
