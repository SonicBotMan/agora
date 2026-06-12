import { describe, expect, it } from 'vitest';

import { McpBridgeServer } from '../main/libs/mcpBridgeServer';
import { McpServerManager } from '../main/libs/mcpServerManager';
import { McpStore } from '../main/mcpStore';
import {
  McpBridgeServer as FacadeMcpBridgeServer,
  McpServerManager as FacadeMcpServerManager,
  McpStore as FacadeMcpStore,
} from './index';

describe('mcp facade exports', () => {
  it('re-exports the documented MCP module surface from the real implementation', () => {
    expect(FacadeMcpBridgeServer).toBe(McpBridgeServer);
    expect(FacadeMcpServerManager).toBe(McpServerManager);
    expect(FacadeMcpStore).toBe(McpStore);
  });
});
