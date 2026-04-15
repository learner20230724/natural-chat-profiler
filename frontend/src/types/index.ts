export type MessageRole = 'user' | 'assistant' | 'system';
export type SessionStatus = 'active' | 'archived' | 'deleted';
export type ReasonerJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ReasonerTriggerType = 'message_threshold' | 'timer' | 'manual';
export type RevisionSource = 'reasoner' | 'manual' | 'system';

export interface ProfileFieldDefinition {
  key: string;
  label: string;
  placeholder?: string | null;
  promptHint?: string | null;
}

export interface ReasoningStep {
  reasoningText: string | null;
  finalOutputText: string | null;
  timestamp: Date;
  triggerType?: ReasonerTriggerType | 'manual_edit';
  source?: RevisionSource | 'streaming';
}

export type MessageUiStatus = 'queued' | 'streaming' | 'cancelled' | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  sequenceNo?: number;
  modelName?: string | null;
  streamCompleted?: boolean;
  uiStatus?: MessageUiStatus;
}

export interface ProfileData {
  sessionId?: string;
  values: Record<string, string | null>;
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
  profileFieldDefinitions: ProfileFieldDefinition[];
}

export interface SessionDetail {
  session: Session;
  messages: Message[];
  profile: ProfileData | null;
  profileFieldDefinitions: ProfileFieldDefinition[];
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

export interface LoadingState {
  sessions: boolean;
  sessionDetail: boolean;
  creatingSession: boolean;
  deletingSessionId: string | null;
  clearingAllData: boolean;
  exportingPdf: boolean;
  analyzingProfile: boolean;
}

export interface AppState {
  currentSessionId: string | null;
  sessions: Session[];
  messages: Message[];
  profileData: ProfileData;
  profileFieldDefinitions: ProfileFieldDefinition[];
  loading: LoadingState;
  isStreaming: boolean;
  activeStreamCount: number;
  error: string | null;
}
