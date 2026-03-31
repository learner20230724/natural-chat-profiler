import { config } from '../../config';
import { MessageRole } from '../../types';

export interface AIMessage {
  role: MessageRole | 'system';
  content: string;
}

export interface ReasonerResult {
  profileData: Record<string, string | null>;
  reasoning: string;
  finalOutputText: string;
}

interface ChatCompletionChunk {
  choices: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
}

export class DeepSeekClient {
  private readonly apiKey = config.deepseek.apiKey;
  private readonly baseUrl = config.deepseek.baseUrl;
  private readonly requestTimeoutMs = 300_000;

  constructor() {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }
  }

  async streamChat(
    messages: AIMessage[],
    onChunk?: (chunk: string) => void,
    options?: {
      signal?: AbortSignal;
      timeoutMs?: number;
    }
  ) {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          stream: true,
          temperature: 0.7,
        }),
        signal: options?.signal,
      },
      options?.timeoutMs
    );

    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek chat failed: ${response.status} ${response.statusText}`);
    }

    return this.processContentStream(response.body, onChunk, options?.signal);
  }

  async createSessionTitle(
    messages: AIMessage[],
    options?: {
      signal?: AbortSignal;
      timeoutMs?: number;
    }
  ) {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.5,
          max_tokens: 50,
        }),
        signal: options?.signal,
      },
      options?.timeoutMs
    );

    if (!response.ok) {
      throw new Error(`DeepSeek title generation failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content?.trim() ?? null;
  }

  async streamReasoner(
    messages: AIMessage[],
    onReasoningChunk?: (chunk: string) => void,
    options?: {
      signal?: AbortSignal;
      timeoutMs?: number;
    }
  ): Promise<ReasonerResult> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages,
          stream: true,
          temperature: 0.3,
        }),
        signal: options?.signal,
      },
      options?.timeoutMs
    );

    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek reasoner failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reasoning = '';
    let content = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (options?.signal?.aborted) {
          throw abortError();
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) {
            continue;
          }

          const payload = safeParseJson<ChatCompletionChunk>(trimmed.slice(6));
          if (!payload) {
            continue;
          }

          const delta = payload.choices[0]?.delta;

          if (delta?.reasoning_content) {
            reasoning += delta.reasoning_content;
            onReasoningChunk?.(delta.reasoning_content);
          }

          if (delta?.content) {
            content += delta.content;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      profileData: extractProfileData(content),
      reasoning: reasoning || '分析完成',
      finalOutputText: content.trim(),
    };
  }

  private async processContentStream(body: ReadableStream<Uint8Array>, onChunk?: (chunk: string) => void, signal?: AbortSignal) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (signal?.aborted) {
          throw abortError();
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) {
            continue;
          }

          const payload = safeParseJson<ChatCompletionChunk>(trimmed.slice(6));
          if (!payload) {
            continue;
          }

          const chunk = payload.choices[0]?.delta?.content;
          if (chunk) {
            fullContent += chunk;
            onChunk?.(chunk);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }

  private async fetchWithTimeout(input: string, init: RequestInit, timeoutMs?: number) {
    const timeoutController = new AbortController();
    const mergedSignal = mergeSignals(init.signal, timeoutController.signal);

    const timer = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs ?? this.requestTimeoutMs);

    try {
      return await fetch(input, {
        ...init,
        signal: mergedSignal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

function mergeSignals(a?: AbortSignal | null, b?: AbortSignal | null) {
  if (!a && !b) return undefined;
  if (a && !b) return a;
  if (!a && b) return b;

  const controller = new AbortController();
  const signals = [a!, b!];

  const onAbort = () => {
    controller.abort();
  };

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}

function abortError() {
  const error = new Error('Request aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractProfileData(content: string) {
  for (const candidate of findBalancedJsonObjects(content)) {
    const parsed = safeParseJson<Record<string, unknown>>(candidate);
    if (!parsed) {
      continue;
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        typeof value === 'string' && value.trim() ? value.trim() : value == null ? null : String(value),
      ])
    );
  }

  return {};
}

function findBalancedJsonObjects(content: string) {
  const candidates: string[] = [];
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (startIndex === -1) {
      if (char === '{') {
        startIndex = index;
        depth = 1;
        inString = false;
        isEscaped = false;
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        candidates.push(content.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return candidates;
}
