import { mergeProfileSnapshot } from '../domain/profileMerge';
import {
  DEFAULT_REASONER_MESSAGE_THRESHOLD,
  DEFAULT_REASONER_TIME_THRESHOLD_MS,
  shouldTriggerReasoner,
} from '../domain/reasonerPolicy';
import { DeepSeekClient } from '../infrastructure/ai/DeepSeekClient';
import { DatabasePool } from '../infrastructure/db/mysql';
import { MessageRepository } from '../infrastructure/repositories/MessageRepository';
import { ProfileRepository } from '../infrastructure/repositories/ProfileRepository';
import { ReasonerJobRepository } from '../infrastructure/repositories/ReasonerJobRepository';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { buildProfileReasonerPrompt } from './ProfilePromptBuilder';
import { NotFoundError, ValidationError } from '../shared/errors';
import { ProfileSnapshot, ReasonerTriggerType } from '../types';

export class ProfileService {
  constructor(
    private readonly pool: DatabasePool,
    private readonly sessions: SessionRepository,
    private readonly messages: MessageRepository,
    private readonly profiles: ProfileRepository,
    private readonly reasonerJobs: ReasonerJobRepository,
    private readonly aiClient: DeepSeekClient
  ) {}

  async getProfile(sessionId: string) {
    await this.ensureSessionExists(sessionId);
    return this.profiles.findBySessionId(sessionId);
  }

  async listRevisions(sessionId: string) {
    await this.ensureSessionExists(sessionId);
    return this.profiles.listRevisions(sessionId);
  }

  async updateProfile(sessionId: string, updates: Record<string, string>) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Lock the session row inside the transaction to avoid stale reads under concurrency
      const session = await this.sessions.lockById(sessionId, connection);
      if (!session) {
        throw new NotFoundError('Session not found');
      }
      const allowedKeys = new Set(session.profileFieldDefinitions.map((field) => field.key));
      const normalizedUpdates: Record<string, string | null> = {};

      Object.entries(updates).forEach(([key, value]) => {
        if (!allowedKeys.has(key)) {
          throw new ValidationError(`字段 ${key} 不在当前会话配置中`);
        }
        normalizedUpdates[key] = value;
      });

      const current = await this.profiles.findBySessionId(sessionId, connection);
      const merged = mergeProfileSnapshot({ current, incoming: normalizedUpdates });
      merged.values = trimProfileValues(merged.values, allowedKeys);
      const version = Math.max(session.profileVersion + 1, (current?.version ?? 0) + 1, 1);

      let existingReasoningText: string | null = null;
      let existingFinalOutputText: string | null = null;
      if (current?.reasoningSummary != null) {
        const revisions = await this.profiles.listRevisions(sessionId, connection);
        const latestRevision = revisions[0];
        existingReasoningText = latestRevision?.reasoningText ?? null;
        existingFinalOutputText = latestRevision?.profileSnapshot.finalOutputText ?? null;
      }

      const saved = await this.profiles.upsert(
        sessionId,
        {
          ...merged,
          version,
        },
        connection
      );

      const snapshot = {
        ...saved,
        finalOutputText: existingFinalOutputText ?? saved.reasoningSummary,
      };

      if (existingReasoningText) {
        await this.profiles.createRevision(
          {
            sessionId,
            source: 'manual',
            snapshot,
            reasoningText: existingReasoningText,
          },
          connection
        );
      } else {
        await this.profiles.createRevision(
          {
            sessionId,
            source: 'manual',
            snapshot,
            reasoningText: saved.reasoningSummary,
          },
          connection
        );
      }

      await this.sessions.markReasonerCompleted(sessionId, version, detectMinorFlag(saved, allowedKeys), connection);
      await connection.commit();

      return saved;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async analyzeProfile(
    sessionId: string,
    triggerType: ReasonerTriggerType,
    onReasoningChunk?: (chunk: string) => void,
    options?: {
      signal?: AbortSignal;
      onStarted?: () => void;
    }
  ) {
    const session = await this.ensureSessionExists(sessionId);
    const current = await this.profiles.findBySessionId(sessionId);
    const messageHistory = await this.messages.listBySession(sessionId);
    const job = await this.reasonerJobs.create(sessionId, triggerType);

    await this.reasonerJobs.markRunning(job.id);
    options?.onStarted?.();

    try {
      // Re-read the session immediately before building the prompt so that
      // field definitions added between the trigger check and now are included.
      // This fresh snapshot is also passed to the persistence transaction so
      // that trimProfileValues uses the up-to-date allowedKeys set.
      const freshSession = (await this.sessions.findById(sessionId)) ?? session;
      const fieldDefinitions = freshSession.profileFieldDefinitions;
      console.log('[reasoner] fieldDefinitions:', fieldDefinitions.map(f => f.key));
      const result = await this.aiClient.streamReasoner(
        buildProfileReasonerPrompt(messageHistory, current, fieldDefinitions),
        onReasoningChunk,
        { signal: options?.signal }
      );

      const revision = await this.runReasonerPersistenceTransaction({
        session: freshSession,
        current,
        jobId: job.id,
        result,
      });

      return { jobId: job.id, profile: revision.profile, revision: revision.revision };
    } catch (error) {
      const failReason = error instanceof Error && error.name === 'AbortError'
        ? '分析已中止'
        : (error instanceof Error ? error.message : 'Unknown reasoner error').slice(0, 500);

      try {
        await this.reasonerJobs.markFailed(job.id, failReason);
      } catch {
        // ignore markFailed errors to preserve the original error
      }

      throw error;
    }
  }

  async shouldAutoAnalyze(sessionId: string) {
    const session = await this.ensureSessionExists(sessionId);
    return this.shouldAutoAnalyzeSession(sessionId, session);
  }

  async maybeAnalyzeProfile(
    sessionId: string,
    onReasoningChunk?: (chunk: string) => void,
    options?: {
      signal?: AbortSignal;
      onStarted?: () => void;
    }
  ) {
    const session = await this.ensureSessionExists(sessionId);
    const trigger = await this.shouldAutoAnalyzeSession(sessionId, session);

    if (!trigger) {
      return null;
    }

    const triggerType: ReasonerTriggerType =
      session.messageCountSinceReasoner >= DEFAULT_REASONER_MESSAGE_THRESHOLD
        ? 'message_threshold'
        : 'timer';

    return this.analyzeProfile(sessionId, triggerType, onReasoningChunk, options);
  }

  async listJobs(sessionId: string) {
    await this.ensureSessionExists(sessionId);
    return this.reasonerJobs.listBySession(sessionId);
  }

  async getJob(jobId: string) {
    const job = await this.reasonerJobs.findById(jobId);
    if (!job) {
      throw new NotFoundError('Reasoner job not found');
    }
    return job;
  }

  private async runReasonerPersistenceTransaction(params: {
    session: Awaited<ReturnType<ProfileService['ensureSessionExists']>>;
    current: Awaited<ReturnType<ProfileRepository['findBySessionId']>>;
    jobId: string;
    result: Awaited<ReturnType<DeepSeekClient['streamReasoner']>>;
  }) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const allowedKeys = new Set(params.session.profileFieldDefinitions.map((field) => field.key));
      const filteredProfileData = trimProfileValues(params.result.profileData, allowedKeys);
      const summaryText = summarizeFinalOutput(params.result.finalOutputText, params.result.reasoning);
      const merged = mergeProfileSnapshot({
        current: params.current,
        incoming: filteredProfileData,
        reasoningSummary: summaryText,
      });
      merged.values = trimProfileValues(merged.values, allowedKeys);
      const version = Math.max(params.session.profileVersion + 1, (params.current?.version ?? 0) + 1, 1);
      const profile = await this.profiles.upsert(
        params.session.id,
        {
          ...merged,
          version,
        },
        connection
      );

      const revision = await this.profiles.createRevision(
        {
          sessionId: params.session.id,
          source: 'reasoner',
          snapshot: {
            ...profile,
            finalOutputText: params.result.finalOutputText || profile.reasoningSummary,
          },
          reasoningText: params.result.reasoning,
        },
        connection
      );

      await this.reasonerJobs.markCompleted(params.jobId, revision.id, connection);
      await this.sessions.markReasonerCompleted(
        params.session.id,
        version,
        detectMinorFlag(profile, allowedKeys),
        connection
      );

      await connection.commit();
      return { profile, revision };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async ensureSessionExists(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    return session;
  }

  private async shouldAutoAnalyzeSession(
    sessionId: string,
    session: Awaited<ReturnType<ProfileService['ensureSessionExists']>>
  ) {
    const hasRunningJob = await this.reasonerJobs.hasRunningJob(sessionId);

    return shouldTriggerReasoner({
      messageCountSinceReasoner: session.messageCountSinceReasoner,
      lastReasonerRunAt: session.lastReasonerRunAt,
      hasRunningJob,
      messageThreshold: DEFAULT_REASONER_MESSAGE_THRESHOLD,
      timeThresholdMs: DEFAULT_REASONER_TIME_THRESHOLD_MS,
    });
  }
}

function detectMinorFlag(profile: ProfileSnapshot | null, allowedKeys: Set<string>) {
  if (!profile || !allowedKeys.has('age')) {
    return false;
  }

  const ageValue = profile.values?.age;
  if (!ageValue) {
    return false;
  }

  return /(未成年|1[0-7]岁|小学|初中|高中)/.test(ageValue);
}

function summarizeFinalOutput(finalOutputText: string, fallback: string) {
  const trimmed = finalOutputText.trim();
  if (!trimmed) {
    return fallback;
  }

  // Remove all top-level JSON objects using balanced bracket parsing to avoid
  // the greedy-regex trap of stripping text between the first { and last }.
  const ranges: Array<[number, number]> = [];
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  let jsonStart = -1;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (isEscaped) { isEscaped = false; }
      else if (ch === '\\') { isEscaped = true; }
      else if (ch === '"') { inString = false; }
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) jsonStart = i;
      depth++;
    } else if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0 && jsonStart !== -1) {
        ranges.push([jsonStart, i + 1]);
        jsonStart = -1;
      }
    }
  }

  let candidate = trimmed;
  for (let i = ranges.length - 1; i >= 0; i--) {
    candidate = candidate.slice(0, ranges[i][0]) + candidate.slice(ranges[i][1]);
  }

  candidate = candidate.trim();
  return candidate || trimmed.slice(0, 400);
}

function trimProfileValues(values: Record<string, string | null>, allowedKeys: Set<string>) {
  const trimmed: Record<string, string | null> = {};
  Object.entries(values ?? {}).forEach(([key, value]) => {
    if (allowedKeys.has(key)) {
      trimmed[key] = value;
    }
  });
  return trimmed;
}
