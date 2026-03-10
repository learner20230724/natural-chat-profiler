import { config } from '../../config';
import { MessageRole } from '../../types';

export interface AIMessage {
  role: MessageRole | 'system';
  content: string;
}

export interface ReasonerResult {
  profileData: {
    age: string | null;
    hometown: string | null;
    currentCity: string | null;
    personality: string | null;
    expectations: string | null;
  };
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

  constructor() {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }
  }

  async streamChat(messages: AIMessage[], onChunk?: (chunk: string) => void) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
    });

    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek chat failed: ${response.status} ${response.statusText}`);
    }

    return this.processContentStream(response.body, onChunk);
  }

  async createSessionTitle(messages: AIMessage[]) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
    });

    if (!response.ok) {
      throw new Error(`DeepSeek title generation failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content?.trim() ?? null;
  }

  async streamReasoner(messages: AIMessage[], onReasoningChunk?: (chunk: string) => void): Promise<ReasonerResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
    });

    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek reasoner failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reasoning = '';
    let content = '';

    try {
      while (true) {
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

          const payload = JSON.parse(trimmed.slice(6)) as ChatCompletionChunk;
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

    console.log('[DEBUG DeepSeekClient] reasoning length:', reasoning.length);
    console.log('[DEBUG DeepSeekClient] reasoning preview:', reasoning.slice(0, 100));
    console.log('[DEBUG DeepSeekClient] content:', content.slice(0, 200));

    return {
      profileData: extractProfileData(content),
      reasoning: reasoning || '分析完成',
      finalOutputText: content.trim(),
    };
  }

  private async processContentStream(body: ReadableStream<Uint8Array>, onChunk?: (chunk: string) => void) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    try {
      while (true) {
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

          const payload = JSON.parse(trimmed.slice(6)) as ChatCompletionChunk;
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
}

function extractProfileData(content: string) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return emptyProfile();
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      age: asNullableString(parsed.age),
      hometown: asNullableString(parsed.hometown),
      currentCity: asNullableString(parsed.currentCity),
      personality: asNullableString(parsed.personality),
      expectations: asNullableString(parsed.expectations),
    };
  } catch {
    return emptyProfile();
  }
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function emptyProfile() {
  return {
    age: null,
    hometown: null,
    currentCity: null,
    personality: null,
    expectations: null,
  };
}
