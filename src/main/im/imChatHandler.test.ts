import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IMChatHandler } from './imChatHandler';
import type { IMMessage, IMSettings } from './types';

const createMessage = (content = 'hello'): IMMessage => ({
  platform: 'feishu',
  messageId: 'msg-1',
  conversationId: 'conv-1',
  senderId: 'user-1',
  content,
  chatType: 'direct',
  timestamp: Date.now(),
});

const createSettings = (overrides: Partial<IMSettings> = {}): IMSettings => ({
  systemPrompt: 'Base prompt',
  skillsEnabled: true,
  ...overrides,
});

const createSSEStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
};

describe('IMChatHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('streams anthropic SSE text cumulatively', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        stream: true,
        system: expect.stringContaining('IM 媒体发送能力'),
      });
      return new Response(createSSEStream([
        'event: content_block_delta\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
        'event: content_block_delta\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n\n',
      ]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const handler = new IMChatHandler({
      getLLMConfig: async () => ({
        apiKey: 'key',
        baseUrl: 'https://api.anthropic.test',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      }),
      getSkillsPrompt: async () => 'Skill prompt',
      imSettings: createSettings(),
    });

    const chunks: Array<{ content: string; done: boolean }> = [];
    for await (const chunk of handler.processMessageStream(createMessage())) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: 'Hello', done: false },
      { content: 'Hello world', done: false },
      { content: 'Hello world', done: true },
    ]);
  });

  it('streams OpenAI responses API SSE text cumulatively', async () => {
    const fetchMock = vi.fn(async () => new Response(createSSEStream([
      'event: response.output_text.delta\n',
      'data: {"delta":"Hi"}\n\n',
      'event: response.output_text.delta\n',
      'data: {"delta":" there"}\n\n',
      'event: response.completed\n',
      'data: {"response":{"output_text":"Hi there"}}\n\n',
    ]), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const handler = new IMChatHandler({
      getLLMConfig: async () => ({
        apiKey: 'key',
        baseUrl: 'https://api.openai.test/v1',
        provider: 'openai',
        model: 'gpt-4.1',
      }),
      getSkillsPrompt: async () => null,
      imSettings: createSettings({ skillsEnabled: false }),
    });

    const chunks: Array<{ content: string; done: boolean }> = [];
    for await (const chunk of handler.processMessageStream(createMessage())) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: 'Hi', done: false },
      { content: 'Hi there', done: false },
      { content: 'Hi there', done: true },
    ]);
  });

  it('uses OpenAI responses completed payload when SSE has no delta events', async () => {
    const fetchMock = vi.fn(async () => new Response(createSSEStream([
      'event: response.completed\n',
      'data: {"response":{"output_text":"Full response"}}\n\n',
    ]), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const handler = new IMChatHandler({
      getLLMConfig: async () => ({
        apiKey: 'key',
        baseUrl: 'https://api.openai.test/v1',
        provider: 'openai',
        model: 'gpt-4.1',
      }),
      getSkillsPrompt: async () => null,
      imSettings: createSettings({ skillsEnabled: false }),
    });

    const chunks: Array<{ content: string; done: boolean }> = [];
    for await (const chunk of handler.processMessageStream(createMessage())) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: 'Full response', done: false },
      { content: 'Full response', done: true },
    ]);
  });

  it('streams OpenAI-compatible chat completions SSE text cumulatively', async () => {
    const fetchMock = vi.fn(async () => new Response(createSSEStream([
      'data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" answer"}}]}\n\n',
      'data: [DONE]\n\n',
    ]), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const handler = new IMChatHandler({
      getLLMConfig: async () => ({
        apiKey: 'key',
        baseUrl: 'https://api.deepseek.test',
        provider: 'deepseek',
        model: 'deepseek-chat',
      }),
      getSkillsPrompt: async () => null,
      imSettings: createSettings({ skillsEnabled: false }),
    });

    const chunks: Array<{ content: string; done: boolean }> = [];
    for await (const chunk of handler.processMessageStream(createMessage())) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: 'Partial', done: false },
      { content: 'Partial answer', done: false },
      { content: 'Partial answer', done: true },
    ]);
  });

  it('falls back to non-streaming responses when streaming fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('stream unavailable');
    }));
    const axiosSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        choices: [{ message: { content: 'Fallback response' } }],
      },
    } as any);

    const handler = new IMChatHandler({
      getLLMConfig: async () => ({
        apiKey: 'key',
        baseUrl: 'https://api.deepseek.test',
        provider: 'deepseek',
        model: 'deepseek-chat',
      }),
      getSkillsPrompt: async () => null,
      imSettings: createSettings({ skillsEnabled: false }),
    });

    const chunks: Array<{ content: string; done: boolean }> = [];
    for await (const chunk of handler.processMessageStream(createMessage())) {
      chunks.push(chunk);
    }

    expect(axiosSpy).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual([{ content: 'Fallback response', done: true }]);
  });
});
