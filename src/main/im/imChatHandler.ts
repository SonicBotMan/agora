/**
 * IM Chat Handler
 * Processes IM messages through LLM service with optional skills integration
 */

import axios from 'axios';

import { buildIMMediaInstruction } from './imMediaInstruction';
import {
  IMMessage,
  IMSettings,
} from './types';

// LLM Configuration interface (mirrors app_config structure)
interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model?: string;
  provider?: string;
}

type StreamChunk = { content: string; done: boolean };
type SSEEvent = { event: string; data: string };

export interface IMChatHandlerOptions {
  getLLMConfig: () => Promise<LLMConfig | null>;
  getSkillsPrompt?: () => Promise<string | null>;
  imSettings: IMSettings;
}

export class IMChatHandler {
  private options: IMChatHandlerOptions;

  constructor(options: IMChatHandlerOptions) {
    this.options = options;
  }

  /**
   * Process an incoming IM message and generate a response
   */
  async processMessage(message: IMMessage): Promise<string> {
    const llmConfig = await this.options.getLLMConfig();
    if (!llmConfig) {
      throw new Error('LLM configuration not found');
    }

    const systemPrompt = await this.buildSystemPrompt();

    // Call LLM API
    const response = await this.callLLM(llmConfig, message.content, systemPrompt);
    return response;
  }

  /**
   * Call LLM API and get response (non-streaming for simplicity)
   */
  private async callLLM(
    config: LLMConfig,
    userMessage: string,
    systemPrompt?: string
  ): Promise<string> {
    const provider = this.detectProvider(config);

    if (provider === 'anthropic') {
      return this.callAnthropicAPI(config, userMessage, systemPrompt);
    }

    // Default to OpenAI-compatible API
    return this.callOpenAICompatibleAPI(config, userMessage, systemPrompt);
  }

  /**
   * Detect provider from config
   */
  private detectProvider(config: LLMConfig): 'anthropic' | 'openai' {
    if (config.provider === 'anthropic') return 'anthropic';
    if (config.baseUrl.includes('anthropic')) return 'anthropic';
    if (config.model?.startsWith('claude')) return 'anthropic';
    return 'openai';
  }

  private buildOpenAICompatibleChatCompletionsUrl(config: LLMConfig): string {
    const normalized = config.baseUrl.replace(/\/+$/, '');
    if (!normalized) {
      return '/v1/chat/completions';
    }
    if (normalized.endsWith('/chat/completions')) {
      return normalized;
    }

    const isGeminiLike =
      config.provider === 'gemini'
      || config.model?.startsWith('gemini')
      || normalized.includes('generativelanguage.googleapis.com');
    if (isGeminiLike) {
      if (normalized.endsWith('/v1beta/openai') || normalized.endsWith('/v1/openai')) {
        return `${normalized}/chat/completions`;
      }
      if (normalized.endsWith('/v1beta') || normalized.endsWith('/v1')) {
        const betaBase = normalized.endsWith('/v1')
          ? `${normalized.slice(0, -3)}v1beta`
          : normalized;
        return `${betaBase}/openai/chat/completions`;
      }
      return `${normalized}/v1beta/openai/chat/completions`;
    }

    if (normalized.endsWith('/v1')) {
      return `${normalized}/chat/completions`;
    }
    return `${normalized}/v1/chat/completions`;
  }

  private buildOpenAIResponsesUrl(config: LLMConfig): string {
    const normalized = config.baseUrl.replace(/\/+$/, '');
    if (!normalized) {
      return '/v1/responses';
    }
    if (normalized.endsWith('/responses')) {
      return normalized;
    }
    if (normalized.endsWith('/v1')) {
      return `${normalized}/responses`;
    }
    return `${normalized}/v1/responses`;
  }

  private shouldUseOpenAIResponsesApi(config: LLMConfig): boolean {
    return config.provider?.toLowerCase() === 'openai';
  }

  private shouldUseMaxCompletionTokens(config: LLMConfig): boolean {
    const provider = config.provider?.toLowerCase();
    if (provider !== 'openai') {
      return false;
    }
    const normalizedModel = config.model?.toLowerCase() || '';
    const resolvedModel = normalizedModel.includes('/')
      ? normalizedModel.slice(normalizedModel.lastIndexOf('/') + 1)
      : normalizedModel;
    return resolvedModel.startsWith('gpt-5')
      || resolvedModel.startsWith('o1')
      || resolvedModel.startsWith('o3')
      || resolvedModel.startsWith('o4');
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropicAPI(
    config: LLMConfig,
    userMessage: string,
    systemPrompt?: string
  ): Promise<string> {
    const url = `${config.baseUrl.replace(/\/$/, '')}/v1/messages`;

    const body: any = {
      model: config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userMessage }],
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await axios.post(url, body, {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    // Extract text from response
    return this.extractAnthropicText(response.data);
  }

  /**
   * Call OpenAI-compatible API
   */
  private async callOpenAICompatibleAPI(
    config: LLMConfig,
    userMessage: string,
    systemPrompt?: string
  ): Promise<string> {
    const useResponsesApi = this.shouldUseOpenAIResponsesApi(config);
    const url = useResponsesApi
      ? this.buildOpenAIResponsesUrl(config)
      : this.buildOpenAICompatibleChatCompletionsUrl(config);

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    const body: Record<string, unknown> = useResponsesApi
      ? {
          model: config.model || 'gpt-4o',
          input: [{ role: 'user', content: [{ type: 'input_text', text: userMessage }] }],
          max_output_tokens: 4096,
        }
      : {
          model: config.model || 'gpt-4o',
          messages,
        };
    if (useResponsesApi && systemPrompt) {
      body.instructions = systemPrompt;
    }
    if (!useResponsesApi) {
      if (this.shouldUseMaxCompletionTokens(config)) {
        body.max_completion_tokens = 4096;
      } else {
        body.max_tokens = 4096;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const response = await axios.post(url, body, { headers });

    if (useResponsesApi) {
      return this.extractResponsesText(response.data);
    }
    return this.extractOpenAICompatibleText(response.data);
  }

  private extractResponsesText(payload: any): string {
    if (typeof payload?.output_text === 'string' && payload.output_text) {
      return payload.output_text;
    }

    const output = Array.isArray(payload?.output) ? payload.output : [];
    const chunks: string[] = [];
    output.forEach((item: any) => {
      if (!Array.isArray(item?.content)) {
        return;
      }
      item.content.forEach((contentItem: any) => {
        if (typeof contentItem?.text === 'string' && contentItem.text) {
          chunks.push(contentItem.text);
        }
      });
    });
    return chunks.join('');
  }

  private extractAnthropicText(payload: any): string {
    const content = payload?.content;
    if (Array.isArray(content)) {
      return content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }

    return content?.text || content || '';
  }

  private extractOpenAICompatibleText(payload: any): string {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (typeof item?.text === 'string') return item.text;
          return '';
        })
        .filter(Boolean)
        .join('');
    }
    return '';
  }

  private async buildSystemPrompt(): Promise<string> {
    let systemPrompt = this.options.imSettings.systemPrompt || '';

    if (this.options.imSettings.skillsEnabled && this.options.getSkillsPrompt) {
      const skillsPrompt = await this.options.getSkillsPrompt();
      if (skillsPrompt) {
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n${skillsPrompt}`
          : skillsPrompt;
      }
    }

    const mediaInstruction = buildIMMediaInstruction(this.options.imSettings);
    if (mediaInstruction) {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${mediaInstruction}`
        : mediaInstruction;
    }

    return systemPrompt;
  }

  private async *callLLMStream(
    config: LLMConfig,
    userMessage: string,
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk> {
    const provider = this.detectProvider(config);

    if (provider === 'anthropic') {
      yield* this.callAnthropicAPIStream(config, userMessage, systemPrompt);
      return;
    }

    yield* this.callOpenAICompatibleAPIStream(config, userMessage, systemPrompt);
  }

  private async *callAnthropicAPIStream(
    config: LLMConfig,
    userMessage: string,
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk> {
    const url = `${config.baseUrl.replace(/\/$/, '')}/v1/messages`;

    const body: Record<string, unknown> = {
      model: config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      stream: true,
      messages: [{ role: 'user', content: userMessage }],
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Anthropic stream failed: ${response.status} ${response.statusText}`);
    }

    if (!this.isSSE(response)) {
      yield {
        content: this.extractAnthropicText(await response.json()),
        done: true,
      };
      return;
    }

    let accumulated = '';
    let emitted = false;

    for await (const sse of this.iterateSSE(response)) {
      if (sse.data === '[DONE]') continue;

      let parsed: any;
      try {
        parsed = JSON.parse(sse.data);
      } catch {
        continue;
      }

      const eventType = sse.event || String(parsed?.type || '');
      if (eventType !== 'content_block_delta' || parsed?.delta?.type !== 'text_delta') {
        continue;
      }

      const delta = typeof parsed?.delta?.text === 'string' ? parsed.delta.text : '';
      if (!delta) continue;

      accumulated += delta;
      emitted = true;
      yield { content: accumulated, done: false };
    }

    if (emitted) {
      yield { content: accumulated, done: true };
    }
  }

  private async *callOpenAICompatibleAPIStream(
    config: LLMConfig,
    userMessage: string,
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk> {
    const useResponsesApi = this.shouldUseOpenAIResponsesApi(config);
    const url = useResponsesApi
      ? this.buildOpenAIResponsesUrl(config)
      : this.buildOpenAICompatibleChatCompletionsUrl(config);

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    const body: Record<string, unknown> = useResponsesApi
      ? {
          model: config.model || 'gpt-4o',
          input: [{ role: 'user', content: [{ type: 'input_text', text: userMessage }] }],
          max_output_tokens: 4096,
          stream: true,
        }
      : {
          model: config.model || 'gpt-4o',
          messages,
          stream: true,
        };

    if (useResponsesApi && systemPrompt) {
      body.instructions = systemPrompt;
    }
    if (!useResponsesApi) {
      if (this.shouldUseMaxCompletionTokens(config)) {
        body.max_completion_tokens = 4096;
      } else {
        body.max_tokens = 4096;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible stream failed: ${response.status} ${response.statusText}`);
    }

    if (!this.isSSE(response)) {
      const payload = await response.json();
      yield {
        content: useResponsesApi
          ? this.extractResponsesText(payload)
          : this.extractOpenAICompatibleText(payload),
        done: true,
      };
      return;
    }

    let accumulated = '';
    let emitted = false;

    for await (const sse of this.iterateSSE(response)) {
      if (sse.data === '[DONE]') continue;

      let parsed: any;
      try {
        parsed = JSON.parse(sse.data);
      } catch {
        continue;
      }

      const delta = useResponsesApi
        ? this.extractResponsesStreamDelta(sse.event, parsed, accumulated.length > 0)
        : this.extractChatCompletionsStreamDelta(parsed);

      if (!delta) continue;

      accumulated += delta;
      emitted = true;
      yield { content: accumulated, done: false };
    }

    if (emitted) {
      yield { content: accumulated, done: true };
    }
  }

  private extractChatCompletionsStreamDelta(payload: any): string {
    const delta = payload?.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') {
      return delta;
    }
    if (Array.isArray(delta)) {
      return delta
        .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
        .filter(Boolean)
        .join('');
    }
    return '';
  }

  private extractResponsesStreamDelta(
    event: string,
    payload: any,
    hasAccumulatedContent = false,
  ): string {
    const eventType = event || String(payload?.type || '');
    if (
      (eventType === 'response.output_text.delta' || eventType === 'response.output.delta')
      && typeof payload?.delta === 'string'
    ) {
      return payload.delta;
    }

    if (
      (eventType === 'response.completed' || eventType === 'response.output_item.done')
      && !payload?.delta
      && !hasAccumulatedContent
    ) {
      const completed = this.extractResponsesText(payload?.response ?? payload);
      return completed || '';
    }

    return '';
  }

  private isSSE(response: Response): boolean {
    return (response.headers.get('content-type') || '').toLowerCase().includes('text/event-stream');
  }

  private async *iterateSSE(response: Response): AsyncGenerator<SSEEvent> {
    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';
    let currentData: string[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line) {
          if (currentData.length > 0) {
            yield {
              event: currentEvent,
              data: currentData.join('\n'),
            };
          }
          currentEvent = '';
          currentData = [];
          continue;
        }
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          currentData.push(line.slice(5).trimStart());
        }
      }
    }

    buffer += decoder.decode();
    const tail = buffer.replace(/\r/g, '').trim();
    if (tail.startsWith('data:')) {
      currentData.push(tail.slice(5).trimStart());
    }
    if (currentData.length > 0) {
      yield {
        event: currentEvent,
        data: currentData.join('\n'),
      };
    }
  }

  /**
   * Process message with streaming (for AI cards)
   */
  async *processMessageStream(
    message: IMMessage
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const llmConfig = await this.options.getLLMConfig();
    if (!llmConfig) {
      throw new Error('LLM configuration not found');
    }

    const systemPrompt = await this.buildSystemPrompt();
    let emitted = false;

    try {
      for await (const chunk of this.callLLMStream(llmConfig, message.content, systemPrompt)) {
        emitted = true;
        yield chunk;
      }
      if (emitted) {
        return;
      }
    } catch (error) {
      console.warn('[IMChatHandler] Streaming failed, falling back to non-streaming response:', error);
    }

    const response = await this.callLLM(llmConfig, message.content, systemPrompt);
    yield { content: response, done: true };
  }
}
