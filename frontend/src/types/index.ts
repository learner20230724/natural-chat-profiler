export type MessageRole = 'user' | 'assistant' | 'system';
export type SessionStatus = 'active' | 'archived' | 'deleted';
export type ReasonerJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ReasonerTriggerType = 'message_threshold' | 'timer' | 'manual';
export type RevisionSource = 'reasoner' | 'manual' | 'system';

export interface ReasoningStep {
  reasoningText: string | null;
  finalOutputText: string | null;
  timestamp: Date;
  triggerType?: ReasonerTriggerType | 'manual_edit';
  source?: RevisionSource | 'streaming';
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  sequenceNo?: number;
  modelName?: string | null;
  streamCompleted?: boolean;
}

export interface ProfileData {
  sessionId?: string;
  age: string | null;
  hometown: string | null;
  currentCity: string | null;
  personality: string | null;
  expectations: string | null;
  reasoning: string | null;
  reasoningHistory: ReasoningStep[];
  currentReasoningDraft: string | null;
  currentFinalDraft: string | null;
  isReasoningStreaming: boolean;
  lastUpdated: Date | null;
  version: number;
}

export interface ProfileRevision {
  id: string;
  sessionId: string;
  source: RevisionSource;
  reasoningText: string | null;
  finalOutputText: string | null;
  createdAt: Date;
  profileSnapshot: Omit<ProfileData, 'reasoningHistory' | 'currentReasoningDraft' | 'currentFinalDraft' | 'isReasoningStreaming' | 'lastUpdated'> & {
    reasoningSummary?: string | null;
    finalOutputText?: string | null;
  };
}

export interface ReasonerJob {
  id: string;
  sessionId: string;
  triggerType: ReasonerTriggerType;
  status: ReasonerJobStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  resultRevisionId: string | null;
  createdAt: Date;
}

export interface Session {
  id: string;
  title: string | null;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  lastReasonerRunAt: Date | null;
  messageCountSinceReasoner: number;
  profileVersion: number;
  isMinorFlagged: boolean;
  privacyClearedAt: Date | null;
  preview: string;
}

export interface SessionDetail {
  session: Session;
  messages: Message[];
  profile: ProfileData | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: ApiError | null;
  meta?: Record<string, unknown>;
}

export interface AppState {
  currentSessionId: string | null;
  sessions: Session[];
  messages: Message[];
  profileData: ProfileData;
  isLoading: boolean;
  isStreaming: boolean;
  activeStreamCount: number;
  error: string | null;
}
