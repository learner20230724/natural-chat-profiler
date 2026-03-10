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
    age: null,
    hometown: null,
    currentCity: null,
    personality: null,
    expectations: null,
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

function mapProfileData(
  profileData:
    | {
        sessionId?: string;
        age: string | null;
        hometown: string | null;
        currentCity: string | null;
        personality: string | null;
        expectations: string | null;
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

  return {
    sessionId: profileData.sessionId,
    age: profileData.age ?? null,
    hometown: profileData.hometown ?? null,
    currentCity: profileData.currentCity ?? null,
    personality: profileData.personality ?? null,
    expectations: profileData.expectations ?? null,
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
      finalOutputText: revision.profileSnapshot.finalOutputText || revision.profileSnapshot.reasoningSummary || null,
      timestamp: new Date(revision.createdAt),
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

export const sessionApi = {
  async createSession(): Promise<Session> {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<ApiResponse<Session>>(response);
    return mapSession(result.data);
  },

  async listSessions(): Promise<Session[]> {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    const result = await handleResponse<ApiResponse<Session[]>>(response);
    return result.data.map(mapSession);
  },

  async getSession(sessionId: string): Promise<SessionDetail> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
    const result = await handleResponse<ApiResponse<SessionDetail>>(response);

    return {
      session: mapSession(result.data.session),
      messages: result.data.messages.map(mapMessage),
      profile: result.data.profile ? mapProfileData(result.data.profile) : null,
    };
  },

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    await handleResponse<ApiResponse<{ sessionId: string }>>(response);
  },

  async clearAllData(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sessions/data`, {
      method: 'DELETE',
    });
    await handleResponse<ApiResponse<{ cleared: boolean }>>(response);
  },

  async organizeSessions(): Promise<{ sessions: Session[]; deletedCount: number; renamedCount: number }> {
    const response = await fetch(`${API_BASE_URL}/sessions/organize`, {
      method: 'POST',
    });
    const result = await handleResponse<ApiResponse<{ sessions: Session[]; deletedCount: number; renamedCount: number }>>(response);
    return {
      sessions: result.data.sessions.map(mapSession),
      deletedCount: result.data.deletedCount,
      renamedCount: result.data.renamedCount,
    };
  },
};

export const messageApi = {
  async getMessages(sessionId: string): Promise<Message[]> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/messages`);
    const result = await handleResponse<ApiResponse<Message[]>>(response);
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
    onAbort?: () => void
  ): AbortController {
    const abortController = new AbortController();
    let completed = false;

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
    abortController.signal.addEventListener('abort', abort);

    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: abortController.signal,
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
            finish();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as {
                type?: string;
                content?: string;
                data?: unknown;
                error?: string;
              };

              if (parsed.type === 'assistant_chunk' && parsed.content) {
                onChunk(parsed.content);
              } else if (parsed.type === 'reasoner_started') {
                onReasoningStart?.();
              } else if (parsed.type === 'reasoner_chunk' && parsed.content) {
                onReasoningChunk?.(parsed.content);
              } else if (parsed.type === 'profile_updated' && parsed.data) {
                onProfileUpdate?.(mapProfileData(parsed.data as Parameters<typeof mapProfileData>[0]));
              } else if (parsed.type === 'reasoner_completed') {
                onReasoningComplete?.(
                  (parsed as { finalOutputText?: string | null }).finalOutputText ?? null,
                  (parsed as { reasoningText?: string | null }).reasoningText ?? null
                );
              } else if (parsed.type === 'assistant_done' || parsed.type === 'done') {
                finish();
                return;
              } else if (parsed.type === 'error') {
                throw new ApiClientError(parsed.error || parsed.content || 'Unknown error');
              }
            } catch (parseError) {
              if (parseError instanceof ApiClientError) {
                throw parseError;
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          abort();
          return;
        }

        onError(error instanceof Error ? error : new Error('Unknown error occurred'));
      }
    })();

    return abortController;
  },
};

export const profileApi = {
  async getProfileData(sessionId: string): Promise<ProfileData> {
    const [profileResponse, revisionsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/sessions/${sessionId}/profile`),
      fetch(`${API_BASE_URL}/sessions/${sessionId}/profile/revisions`),
    ]);

    const profileResult = await handleResponse<ApiResponse<ProfileData | null>>(profileResponse);
    const revisionsResult = await handleResponse<ApiResponse<ProfileRevision[]>>(revisionsResponse);

    return mapProfileData(profileResult.data, buildReasoningHistory(revisionsResult.data));
  },

  async analyzeProfile(sessionId: string): Promise<ProfileData> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/profile/analyze`, {
      method: 'POST',
    });
    const result = await handleResponse<
      ApiResponse<{
        jobId: string;
        profile: ProfileData;
        revision: ProfileRevision;
      }>
    >(response);

    return mapProfileData(result.data.profile, [{
      reasoningText: result.data.revision.reasoningText || null,
      finalOutputText: result.data.revision.profileSnapshot.finalOutputText || result.data.revision.profileSnapshot.reasoningSummary || null,
      timestamp: new Date(result.data.revision.createdAt),
    }]);
  },

  async updateProfileField(
    sessionId: string,
    field: string,
    value: string
  ): Promise<ProfileData> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });

    const result = await handleResponse<ApiResponse<ProfileData>>(response);
    return mapProfileData(result.data);
  },

  async getProfileRevisions(sessionId: string): Promise<ProfileRevision[]> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/profile/revisions`);
    const result = await handleResponse<ApiResponse<ProfileRevision[]>>(response);
    return result.data.map(mapProfileRevision);
  },

  async getReasonerJobs(sessionId: string): Promise<ReasonerJob[]> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/reasoner-jobs`);
    const result = await handleResponse<ApiResponse<ReasonerJob[]>>(response);
    return result.data.map(mapReasonerJob);
  },
};

export const exportApi = {
  async downloadPDF(sessionId: string, filename = 'profile.pdf'): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/export/pdf`);
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
