import type {
  ApiResponse,
  Message,
  ProfileData,
  ProfileRevision,
  ReasonerJob,
  Session,
  SessionDetail,
} from '../types';

const API_BASE_URL = '/api';

function createEmptyProfileData(): ProfileData {
  return {
    sessionId: undefined,
    values: {},
    reasoning: null,
    reasoningHistory: [],
    currentReasoningDraft: null,
    currentFinalDraft: null,
    isReasoningStreaming: false,
    lastUpdated: null,
    version: 0,
  };
}

function mapMessage(message: {
  id: string;
  role: Message['role'];
  content: string;
  createdAt?: string | Date;
  timestamp?: string | Date;
  sequenceNo?: number;
  modelName?: string | null;
  streamCompleted?: boolean;
}): Message {
  const rawTimestamp = message.timestamp ?? message.createdAt ?? new Date();

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(rawTimestamp),
    sequenceNo: message.sequenceNo,
    modelName: message.modelName ?? null,
    streamCompleted: message.streamCompleted,
  };
}

function mapLegacyProfileValues(profileData: {
  age?: string | null;
  hometown?: string | null;
  currentCity?: string | null;
  personality?: string | null;
  expectations?: string | null;
}) {
  return {
    age: profileData.age ?? null,
    hometown: profileData.hometown ?? null,
    currentCity: profileData.currentCity ?? null,
    personality: profileData.personality ?? null,
    expectations: profileData.expectations ?? null,
  };
}

function normalizeProfileValues(
  values: unknown,
  profileData: {
    age?: string | null;
    hometown?: string | null;
    currentCity?: string | null;
    personality?: string | null;
    expectations?: string | null;
  }
): Record<string, string | null> {
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    return values as Record<string, string | null>;
  }

  return mapLegacyProfileValues(profileData);
}

function mapProfileData(
  profileData:
    | {
        sessionId?: string;
        values?: Record<string, string | null>;
        age?: string | null;
        hometown?: string | null;
        currentCity?: string | null;
        personality?: string | null;
        expectations?: string | null;
        reasoning?: string | null;
        reasoningSummary?: string | null;
        updatedAt?: string | Date | null;
        version?: number;
      }
    | null
    | undefined,
  reasoningHistory: ProfileData['reasoningHistory'] = [],
  isReasoningStreaming = false
): ProfileData {
  if (!profileData) {
    return createEmptyProfileData();
  }

  const values = normalizeProfileValues(profileData.values, profileData);

  return {
    sessionId: profileData.sessionId,
    values,
    reasoning: profileData.reasoningSummary ?? profileData.reasoning ?? null,
    reasoningHistory,
    currentReasoningDraft: null,
    currentFinalDraft: null,
    isReasoningStreaming,
    lastUpdated: profileData.updatedAt ? new Date(profileData.updatedAt) : null,
    version: profileData.version ?? 0,
  };
}

function mapSession(session: Session): Session {
  return {
    ...session,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
    lastMessageAt: session.lastMessageAt ? new Date(session.lastMessageAt) : null,
    lastReasonerRunAt: session.lastReasonerRunAt ? new Date(session.lastReasonerRunAt) : null,
    privacyClearedAt: session.privacyClearedAt ? new Date(session.privacyClearedAt) : null,
  };
}

function mapProfileRevision(revision: ProfileRevision): ProfileRevision {
  return {
    ...revision,
    createdAt: new Date(revision.createdAt),
  };
}

function mapReasonerJob(job: ReasonerJob): ReasonerJob {
  return {
    ...job,
    startedAt: job.startedAt ? new Date(job.startedAt) : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt) : null,
    createdAt: new Date(job.createdAt),
  };
}

function buildReasoningHistory(revisions: ProfileRevision[]) {
  return revisions
    .slice()
    .reverse()
    .map((revision) => ({
      reasoningText: revision.reasoningText || null,
      finalOutputText:
        revision.profileSnapshot.finalOutputText || revision.profileSnapshot.reasoningSummary || null,
      timestamp: new Date(revision.createdAt),
      source: revision.source,
    }));
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = response.status.toString();
    let errorDetails: unknown;

    try {
      const errorData = (await response.json()) as ApiResponse<null>;
      errorMessage = errorData.error?.message || errorMessage;
      errorCode = errorData.error?.code || errorCode;
      errorDetails = errorData.error?.details;
    } catch {
      // ignore non-json errors
    }

    throw new ApiClientError(errorMessage, errorCode, errorDetails);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  return response.json();
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(input, init);
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ApiClientError(error.message || '网络请求失败');
    }

    throw new ApiClientError('网络请求失败');
  }
}

export const sessionApi = {
  async createSession(): Promise<Session> {
    const result = await fetchJson<ApiResponse<Session>>(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return mapSession(result.data);
  },

  async listSessions(): Promise<Session[]> {
    const result = await fetchJson<ApiResponse<Session[]>>(`${API_BASE_URL}/sessions`);
    return result.data.map(mapSession);
  },

  async getSession(sessionId: string): Promise<SessionDetail> {
    const result = await fetchJson<ApiResponse<SessionDetail>>(`${API_BASE_URL}/sessions/${sessionId}`);

    return {
      session: mapSession(result.data.session),
      messages: result.data.messages.map(mapMessage),
      profile: result.data.profile ? mapProfileData(result.data.profile) : null,
      profileFieldDefinitions: result.data.profileFieldDefinitions,
    };
  },

  async deleteSession(sessionId: string): Promise<void> {
    await fetchJson<ApiResponse<{ sessionId: string }>>(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  async clearAllData(): Promise<void> {
    await fetchJson<ApiResponse<{ cleared: boolean }>>(`${API_BASE_URL}/sessions/data`, {
      method: 'DELETE',
    });
  },

  async organizeSessions(): Promise<{ sessions: Session[]; deletedCount: number; renamedCount: number }> {
    const result = await fetchJson<ApiResponse<{ sessions: Session[]; deletedCount: number; renamedCount: number }>>(`${API_BASE_URL}/sessions/organize`, {
      method: 'POST',
    });
    return {
      sessions: result.data.sessions.map(mapSession),
      deletedCount: result.data.deletedCount,
      renamedCount: result.data.renamedCount,
    };
  },
};

function collectSseData(eventBlock: string) {
  return eventBlock
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();
}

function parseSsePayload(eventBlock: string) {
  const data = collectSseData(eventBlock);
  if (!data || data === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(data) as {
      type?: string;
      content?: string;
      data?: unknown;
      error?: string;
      finalOutputText?: string | null;
      reasoningText?: string | null;
    };
  } catch (error) {
    console.warn('Failed to parse SSE payload:', data, error);
    throw new ApiClientError('流式响应格式错误');
  }
}

export const messageApi = {
  async getMessages(sessionId: string): Promise<Message[]> {
    const result = await fetchJson<ApiResponse<Message[]>>(`${API_BASE_URL}/sessions/${sessionId}/messages`);
    return result.data.map(mapMessage);
  },

  sendMessage(
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    onProfileUpdate?: (profileData: ProfileData) => void,
    onReasoningChunk?: (chunk: string) => void,
    onReasoningStart?: () => void,
    onReasoningComplete?: (finalOutputText: string | null, reasoningText?: string | null) => void,
    onAbort?: () => void,
    abortController?: AbortController
  ): AbortController {
    const controller = abortController ?? new AbortController();
    let completed = false;
    let sawTerminalEvent = false;

    const finish = () => {
      if (completed) return;
      completed = true;
      onComplete();
    };

    const abort = () => {
      if (completed) return;
      completed = true;
      onAbort?.();
    };
    controller.signal.addEventListener('abort', abort);

    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ApiClientError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status.toString()
          );
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new ApiClientError('Response body is not readable');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const eventBlocks = buffer.split(/\r?\n\r?\n/);
          buffer = eventBlocks.pop() || '';

          for (const eventBlock of eventBlocks) {
            const parsed = parseSsePayload(eventBlock);
            if (!parsed) {
              continue;
            }

            if (parsed.type === 'assistant_chunk' && parsed.content) {
              onChunk(parsed.content);
            } else if (parsed.type === 'reasoner_started') {
              onReasoningStart?.();
            } else if (parsed.type === 'reasoner_chunk' && parsed.content) {
              onReasoningChunk?.(parsed.content);
            } else if (parsed.type === 'profile_updated' && parsed.data) {
              onProfileUpdate?.(mapProfileData(parsed.data as Parameters<typeof mapProfileData>[0]));
            } else if (parsed.type === 'reasoner_completed') {
              onReasoningComplete?.(parsed.finalOutputText ?? null, parsed.reasoningText ?? null);
            } else if (parsed.type === 'assistant_done' || parsed.type === 'done') {
              sawTerminalEvent = true;
              finish();
              return;
            } else if (parsed.type === 'error') {
              throw new ApiClientError(parsed.error || parsed.content || 'Unknown error');
            }
          }
        }

        const tailPayload = parseSsePayload(buffer);
        if (tailPayload) {
          if (tailPayload.type === 'assistant_chunk' && tailPayload.content) {
            onChunk(tailPayload.content);
          } else if (tailPayload.type === 'reasoner_started') {
            onReasoningStart?.();
          } else if (tailPayload.type === 'reasoner_chunk' && tailPayload.content) {
            onReasoningChunk?.(tailPayload.content);
          } else if (tailPayload.type === 'profile_updated' && tailPayload.data) {
            onProfileUpdate?.(mapProfileData(tailPayload.data as Parameters<typeof mapProfileData>[0]));
          } else if (tailPayload.type === 'reasoner_completed') {
            onReasoningComplete?.(tailPayload.finalOutputText ?? null, tailPayload.reasoningText ?? null);
          } else if (tailPayload.type === 'assistant_done' || tailPayload.type === 'done') {
            sawTerminalEvent = true;
            finish();
            return;
          } else if (tailPayload.type === 'error') {
            throw new ApiClientError(tailPayload.error || tailPayload.content || 'Unknown error');
          }
        }

        if (!sawTerminalEvent) {
          throw new ApiClientError('流式响应异常结束');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          abort();
          return;
        }

        onError(error instanceof Error ? error : new Error('Unknown error occurred'));
      }
    })();

    return controller;
  },
};

export const profileApi = {
  async getProfileData(sessionId: string): Promise<ProfileData> {
    const settledResults = await Promise.allSettled([
      fetchJson<ApiResponse<ProfileData | null>>(`${API_BASE_URL}/sessions/${sessionId}/profile`),
      fetchJson<ApiResponse<ProfileRevision[]>>(`${API_BASE_URL}/sessions/${sessionId}/profile/revisions`),
    ]);

    const profileResult = settledResults[0].status === 'fulfilled' ? settledResults[0].value : null;
    const revisionsResult = settledResults[1].status === 'fulfilled' ? settledResults[1].value : null;
    const errors = settledResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => (result.reason instanceof ApiClientError ? result.reason.message : '网络请求失败'));

    if (!profileResult && !revisionsResult) {
      throw new ApiClientError(errors.join('；') || '加载画像失败');
    }

    const profileData = profileResult?.data ?? null;
    const revisions = revisionsResult?.data ?? [];
    return mapProfileData(profileData, buildReasoningHistory(revisions));
  },

  async analyzeProfile(sessionId: string): Promise<ProfileData> {
    const result = await fetchJson<
      ApiResponse<{
        jobId: string;
        profile: ProfileData;
        revision: ProfileRevision;
      }>
    >(`${API_BASE_URL}/sessions/${sessionId}/profile/analyze`, {
      method: 'POST',
    });

    return mapProfileData(result.data.profile, [{
      reasoningText: result.data.revision.reasoningText || null,
      finalOutputText:
        result.data.revision.profileSnapshot.finalOutputText ||
        result.data.revision.profileSnapshot.reasoningSummary ||
        null,
      timestamp: new Date(result.data.revision.createdAt),
      source: result.data.revision.source,
    }]);
  },

  async updateProfileField(
    sessionId: string,
    field: string,
    value: string
  ): Promise<ProfileData> {
    const result = await fetchJson<ApiResponse<ProfileData>>(`${API_BASE_URL}/sessions/${sessionId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });

    return mapProfileData(result.data);
  },

  async getProfileRevisions(sessionId: string): Promise<ProfileRevision[]> {
    const result = await fetchJson<ApiResponse<ProfileRevision[]>>(`${API_BASE_URL}/sessions/${sessionId}/profile/revisions`);
    return result.data.map(mapProfileRevision);
  },

  async getReasonerJobs(sessionId: string): Promise<ReasonerJob[]> {
    const result = await fetchJson<ApiResponse<ReasonerJob[]>>(`${API_BASE_URL}/sessions/${sessionId}/reasoner-jobs`);
    return result.data.map(mapReasonerJob);
  },
};

export const exportApi = {
  async downloadPDF(sessionId: string, filename = 'profile.pdf'): Promise<void> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/export/pdf`);
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiClientError(error.message || '网络请求失败');
      }
      throw new ApiClientError('网络请求失败');
    }

    if (!response.ok) {
      throw new ApiClientError(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
