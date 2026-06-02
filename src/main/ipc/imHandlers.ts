/**
 * Agora — IM Gateway IPC Handlers
 * Multi-IM integration: WeChat, Telegram, Feishu, Discord, etc.
 */

import { ipcMain } from 'electron';

export interface ImAccount {
  id: string;
  platform: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'connecting' | 'error';
  connectedAt?: string;
}

export interface ImMessage {
  id: string;
  accountId: string;
  chatId: string;
  chatName: string;
  sender: string;
  content: string;
  timestamp: string;
  isGroup: boolean;
  attachments?: { name: string; type: string; url?: string }[];
}

export interface ImDeps {
  // Account management
  addAccount: (platform: string, credentials: Record<string, string>) => Promise<ImAccount>;
  removeAccount: (accountId: string) => Promise<void>;
  listAccounts: () => Promise<ImAccount[]>;
  getAccount: (accountId: string) => Promise<ImAccount | null>;
  connectAccount: (accountId: string) => Promise<void>;
  disconnectAccount: (accountId: string) => Promise<void>;
  reconnectAccount: (accountId: string) => Promise<void>;
  setAccountConfig: (accountId: string, config: Record<string, unknown>) => Promise<void>;
  getAccountConfig: (accountId: string) => Promise<Record<string, unknown>>;

  // Chat operations
  listChats: (accountId: string) => Promise<{ id: string; name: string; unread: number; isGroup: boolean }[]>;
  getChatMessages: (accountId: string, chatId: string, limit?: number) => Promise<ImMessage[]>;
  sendMessage: (accountId: string, chatId: string, content: string) => Promise<void>;
  sendAttachment: (accountId: string, chatId: string, filePath: string) => Promise<void>;
  searchMessages: (accountId: string, query: string) => Promise<ImMessage[]>;
  markAsRead: (accountId: string, chatId: string) => Promise<void>;
  deleteMessage: (accountId: string, chatId: string, messageId: string) => Promise<void>;

  // Group operations
  getGroupInfo: (accountId: string, chatId: string) => Promise<Record<string, unknown>>;
  getGroupMembers: (accountId: string, chatId: string) => Promise<unknown[]>;
  leaveGroup: (accountId: string, chatId: string) => Promise<void>;
  createGroup: (accountId: string, name: string, members: string[]) => Promise<string>;

  // Gateway management
  getGatewayStatus: () => Promise<Record<string, unknown>>;
  setGatewayConfig: (config: Record<string, unknown>) => Promise<void>;
  getGatewayConfig: () => Promise<Record<string, unknown>>;
  restartGateway: () => Promise<void>;
}

export function registerImHandlers(deps: ImDeps): void {
  // ── Account Management ───────────────────────────────
  ipcMain.handle('im:addAccount', async (_event, platform: string, creds: Record<string, string>) => {
    return deps.addAccount(platform, creds);
  });
  ipcMain.handle('im:removeAccount', async (_event, accountId: string) => deps.removeAccount(accountId));
  ipcMain.handle('im:listAccounts', async () => deps.listAccounts());
  ipcMain.handle('im:getAccount', async (_event, accountId: string) => deps.getAccount(accountId));
  ipcMain.handle('im:connect', async (_event, accountId: string) => deps.connectAccount(accountId));
  ipcMain.handle('im:disconnect', async (_event, accountId: string) => deps.disconnectAccount(accountId));
  ipcMain.handle('im:reconnect', async (_event, accountId: string) => deps.reconnectAccount(accountId));
  ipcMain.handle('im:setAccountConfig', async (_event, accountId: string, config: Record<string, unknown>) => {
    await deps.setAccountConfig(accountId, config);
  });
  ipcMain.handle('im:getAccountConfig', async (_event, accountId: string) => {
    return deps.getAccountConfig(accountId);
  });

  // ── Chat Operations ──────────────────────────────────
  ipcMain.handle('im:listChats', async (_event, accountId: string) => deps.listChats(accountId));
  ipcMain.handle('im:getMessages', async (_event, accountId: string, chatId: string, limit?: number) => {
    return deps.getChatMessages(accountId, chatId, limit);
  });
  ipcMain.handle('im:sendMessage', async (_event, accountId: string, chatId: string, content: string) => {
    await deps.sendMessage(accountId, chatId, content);
  });
  ipcMain.handle('im:sendAttachment', async (_event, accountId: string, chatId: string, filePath: string) => {
    await deps.sendAttachment(accountId, chatId, filePath);
  });
  ipcMain.handle('im:searchMessages', async (_event, accountId: string, query: string) => {
    return deps.searchMessages(accountId, query);
  });
  ipcMain.handle('im:markAsRead', async (_event, accountId: string, chatId: string) => {
    await deps.markAsRead(accountId, chatId);
  });
  ipcMain.handle('im:deleteMessage', async (_event, accountId: string, chatId: string, messageId: string) => {
    await deps.deleteMessage(accountId, chatId, messageId);
  });

  // ── Group Operations ─────────────────────────────────
  ipcMain.handle('im:getGroupInfo', async (_event, accountId: string, chatId: string) => {
    return deps.getGroupInfo(accountId, chatId);
  });
  ipcMain.handle('im:getGroupMembers', async (_event, accountId: string, chatId: string) => {
    return deps.getGroupMembers(accountId, chatId);
  });
  ipcMain.handle('im:leaveGroup', async (_event, accountId: string, chatId: string) => {
    await deps.leaveGroup(accountId, chatId);
  });
  ipcMain.handle('im:createGroup', async (_event, accountId: string, name: string, members: string[]) => {
    return deps.createGroup(accountId, name, members);
  });

  // ── Gateway Management ───────────────────────────────
  ipcMain.handle('im:getGatewayStatus', async () => deps.getGatewayStatus());
  ipcMain.handle('im:setGatewayConfig', async (_event, config: Record<string, unknown>) => {
    await deps.setGatewayConfig(config);
  });
  ipcMain.handle('im:getGatewayConfig', async () => deps.getGatewayConfig());
  ipcMain.handle('im:restartGateway', async () => deps.restartGateway());
}
