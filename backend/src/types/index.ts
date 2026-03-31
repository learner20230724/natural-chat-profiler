export type SessionStatus = 'active' | 'archived' | 'deleted';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ReasonerTriggerType = 'message_threshold' | 'timer' | 'manual';
export type ReasonerJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RevisionSource = 'reasoner' | 'manual' | 'system';
export type PrivacyEventType = 'clear_session' | 'clear_all' | 'export_pdf';

export interface ProfileFieldDefinition {
  key: string;
  label: string;
  placeholder?: string | null;
  promptHint?: string | null;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export interface SessionRecord {
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
  isInitializing: boolean;
  profileFieldDefinitions: ProfileFieldDefinition[];
}

export interface SessionListItem extends SessionRecord {
  preview: string;
}

export interface SessionMessageRecord {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  sequenceNo: number;
  createdAt: Date;
  modelName: string | null;
  streamCompleted: boolean;
}

export interface ProfileSnapshot {
  sessionId: string;
  values: Record<string, string | null>;
  confidence: Record<string, number> | null;
  reasoningSummary: string | null;
  updatedAt: Date;
  version: number;
}

export interface ProfileRevisionRecord {
  id: string;
  sessionId: string;
  source: RevisionSource;
  profileSnapshot: Omit<ProfileSnapshot, 'sessionId' | 'updatedAt'> & {
    finalOutputText?: string | null;
  };
  reasoningText: string | null;
  finalOutputText: string | null;
  createdAt: Date;
}

export interface ReasonerJobRecord {
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

export interface SessionSummaryRecord {
  id: string;
  sessionId: string;
  summaryText: string;
  coveredUntilSequence: number;
  createdAt: Date;
}

export interface PrivacyEventRecord {
  id: string;
  sessionId: string | null;
  eventType: PrivacyEventType;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface SessionDetail {
  session: SessionRecord;
  messages: SessionMessageRecord[];
  profile: ProfileSnapshot | null;
  profileFieldDefinitions: ProfileFieldDefinition[];
}

export interface ReasoningStep {
  content: string;
  timestamp: Date;
}
