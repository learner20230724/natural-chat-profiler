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

      const session = await this.ensureSessionExists(sessionId);
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
      const fieldDefinitions = session.profileFieldDefinitions;
      const result = await this.aiClient.streamReasoner(
        buildProfileReasonerPrompt(messageHistory, current, fieldDefinitions),
        onReasoningChunk,
        { signal: options?.signal }
      );

      const revision = await this.runReasonerPersistenceTransaction({
        session,
        current,
        jobId: job.id,
        result,
      });

      return { jobId: job.id, profile: revision.profile, revision: revision.revision };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown reasoner error';

      if (error instanceof Error && error.name === 'AbortError') {
        await this.reasonerJobs.markFailed(job.id, '分析已中止');
        throw error;
      }

      await this.reasonerJobs.markFailed(job.id, message.slice(0, 500));
      throw error;
    }
  }

  async shouldAutoAnalyze(sessionId: string) {
    const session = await this.ensureSessionExists(sessionId);
    const hasRunningJob = await this.reasonerJobs.hasRunningJob(sessionId);

    return shouldTriggerReasoner({
      messageCountSinceReasoner: session.messageCountSinceReasoner,
      lastReasonerRunAt: session.lastReasonerRunAt,
      hasRunningJob,
      messageThreshold: DEFAULT_REASONER_MESSAGE_THRESHOLD,
      timeThresholdMs: DEFAULT_REASONER_TIME_THRESHOLD_MS,
    });
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
    const trigger = await this.shouldAutoAnalyze(sessionId);

    if (!trigger) {
      return null;
    }

    const triggerType: ReasonerTriggerType =
      session.messageCountSinceReasoner >= DEFAULT_REASONER_MESSAGE_THRESHOLD
        ? 'message_threshold'
        : 'timer';

    return this.analyzeProfile(sessionId, triggerType, onReasoningChunk, {
      ...options,
      onStarted: options?.onStarted,
    });
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

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? trimmed.replace(jsonMatch[0], '').trim() : trimmed;
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
