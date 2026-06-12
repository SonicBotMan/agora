import Database from 'better-sqlite3';
import { afterEach, expect, test, vi } from 'vitest';

import { CoworkAgentEngine } from '../../shared/cowork/constants';
import { FeishuEngineKey } from '../../shared/im/constants';
import { IMGatewayManager } from './imGatewayManager';
import { DEFAULT_FEISHU_OPENCLAW_CONFIG, type IMMessage } from './types';

type GatewayReplyFnForTest = ((text: string) => Promise<void>) & {
  finalize?: (text: string) => Promise<void>;
};

const dbs: Database.Database[] = [];

const createManager = () => {
  const db = new Database(':memory:');
  dbs.push(db);

  const manager = new IMGatewayManager(db, {
    getFeishuAgentEngine: () => CoworkAgentEngine.Codex,
  });

  let callback: ((message: IMMessage, replyFn: GatewayReplyFnForTest) => Promise<void>) | null = null;
  (manager as any).nativeFeishuGateway = {
    setMessageCallback(nextCallback: typeof callback) {
      callback = nextCallback;
    },
  };

  manager.setConfig({
    feishu: {
      activeEngineKey: FeishuEngineKey.Codex,
      instances: [{
        ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
        instanceId: 'inst-1',
        instanceName: 'Codex Feishu',
        enabled: true,
        appId: 'cli_codex',
        appSecret: 'secret',
        replyMode: 'streaming',
      }],
    },
  });
  manager.initialize({
    getLLMConfig: async () => ({
      apiKey: 'test',
      baseUrl: 'https://example.com',
      provider: 'openai',
    }),
  });

  if (!callback) {
    throw new Error('Gateway callback was not registered');
  }

  return { manager, callback };
};

const createMessage = (): IMMessage => ({
  platform: 'feishu',
  messageId: 'msg-1',
  conversationId: 'inst-1:direct:chat-1',
  senderId: 'user-1',
  senderName: 'Tester',
  content: 'hello',
  chatType: 'direct',
  timestamp: Date.now(),
});

afterEach(() => {
  vi.restoreAllMocks();
  while (dbs.length > 0) {
    dbs.pop()?.close();
  }
});

test('streams Cowork progress through the native Feishu reply dispatcher', async () => {
  const { manager, callback } = createManager();
  const ensureCoworkReady = vi.fn(async () => undefined);
  const coworkHandler = {
    processMessage: vi.fn(async (_message: IMMessage, options?: { onProgress?: (text: string) => Promise<void> }) => {
      await options?.onProgress?.('第一段');
      await options?.onProgress?.('最终答案');
      return '最终答案';
    }),
  };
  const replyOrder: string[] = [];
  const replyFn = Object.assign(
    vi.fn(async (text: string) => {
      replyOrder.push(`progress:${text}`);
    }),
    {
      finalize: vi.fn(async (text: string) => {
        replyOrder.push(`final:${text}`);
      }),
    },
  ) as GatewayReplyFnForTest;

  (manager as any).ensureCoworkReady = ensureCoworkReady;
  (manager as any).coworkHandler = coworkHandler;

  await callback(createMessage(), replyFn);

  expect(ensureCoworkReady).toHaveBeenCalledTimes(1);
  expect(coworkHandler.processMessage).toHaveBeenCalledTimes(1);
  expect(replyOrder).toEqual([
    'progress:第一段',
    'progress:最终答案',
    'final:最终答案',
  ]);
});

test('streams chat handler output when Cowork is unavailable', async () => {
  const { manager, callback } = createManager();
  const chatHandler = {
    processMessageStream: vi.fn(async function* () {
      yield { content: 'alpha', done: false };
      yield { content: 'alpha beta', done: true };
    }),
    processMessage: vi.fn(async () => 'should not be used'),
  };
  const replyOrder: string[] = [];
  const replyFn = Object.assign(
    vi.fn(async (text: string) => {
      replyOrder.push(`progress:${text}`);
    }),
    {
      finalize: vi.fn(async (text: string) => {
        replyOrder.push(`final:${text}`);
      }),
    },
  ) as GatewayReplyFnForTest;

  (manager as any).coworkHandler = null;
  (manager as any).chatHandler = chatHandler;

  await callback(createMessage(), replyFn);

  expect(chatHandler.processMessageStream).toHaveBeenCalledTimes(1);
  expect(chatHandler.processMessage).not.toHaveBeenCalled();
  expect(replyOrder).toEqual([
    'progress:alpha',
    'final:alpha beta',
  ]);
});
