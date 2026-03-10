import { mergeProfileSnapshot } from '../domain/profileMerge';
import {
  DEFAULT_REASONER_MESSAGE_THRESHOLD,
  DEFAULT_REASONER_TIME_THRESHOLD_MS,
  shouldTriggerReasoner,
} from '../domain/reasonerPolicy';
import { DeepSeekClient } from '../infrastructure/ai/DeepSeekClient';
import { MessageRepository } from '../infrastructure/repositories/MessageRepository';
import { ProfileRepository } from '../infrastructure/repositories/ProfileRepository';
import { ReasonerJobRepository } from '../infrastructure/repositories/ReasonerJobRepository';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { buildProfileReasonerPrompt } from './ProfilePromptBuilder';
import { NotFoundError } from '../shared/errors';
import { ProfileSnapshot, ReasonerTriggerType } from '../types';

export class ProfileService {
  constructor(
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

  async updateProfile(sessionId: string, updates: Partial<Pick<ProfileSnapshot, 'age' | 'hometown' | 'currentCity' | 'personality' | 'expectations'>>) {
    const session = await this.ensureSessionExists(sessionId);
    const current = await this.profiles.findBySessionId(sessionId);
    const merged = mergeProfileSnapshot({ current, incoming: updates });
    const version = Math.max(session.profileVersion + 1, (current?.version ?? 0) + 1, 1);

    // 获取之前的完整 reasoningText（如果之前有 reasoner 生成的思考内容）
    let existingReasoningText: string | null = null;
    if (current?.reasoningSummary != null) {
      const revisions = await this.profiles.listRevisions(sessionId);
      const latestRevision = revisions[0];
      existingReasoningText = latestRevision?.reasoningText ?? null;
    }

    const saved = await this.profiles.upsert(sessionId, {
      ...merged,
      version,
    });

    // 如果之前有思考内容，保留原有的 reasoningText，不被覆盖
    if (existingReasoningText) {
      await this.profiles.createRevision({
        sessionId,
        source: 'manual',
        snapshot: {
          age: saved.age,
          hometown: saved.hometown,
          currentCity: saved.currentCity,
          personality: saved.personality,
          expectations: saved.expectations,
          confidence: saved.confidence,
          reasoningSummary: saved.reasoningSummary,
          version: saved.version,
          finalOutputText: saved.reasoningSummary,
        },
        reasoningText: existingReasoningText,
      });
    } else {
      await this.profiles.createRevision({
        sessionId,
        source: 'manual',
        snapshot: {
          age: saved.age,
          hometown: saved.hometown,
          currentCity: saved.currentCity,
          personality: saved.personality,
          expectations: saved.expectations,
          confidence: saved.confidence,
          reasoningSummary: saved.reasoningSummary,
          version: saved.version,
          finalOutputText: saved.reasoningSummary,
        },
        reasoningText: saved.reasoningSummary,
      });
    }

    await this.sessions.markReasonerCompleted(sessionId, version, detectMinorFlag(saved));
    return saved;
  }

  async analyzeProfile(
    sessionId: string,
    triggerType: ReasonerTriggerType,
    onReasoningChunk?: (chunk: string) => void
  ) {
    const session = await this.ensureSessionExists(sessionId);
    const current = await this.profiles.findBySessionId(sessionId);
    const messageHistory = await this.messages.listBySession(sessionId);
    const job = await this.reasonerJobs.create(sessionId, triggerType);

    await this.reasonerJobs.markRunning(job.id);

    try {
      const result = await this.aiClient.streamReasoner(
        buildProfileReasonerPrompt(messageHistory, current),
        onReasoningChunk
      );

      const summaryText = summarizeFinalOutput(result.finalOutputText, result.reasoning);
      const merged = mergeProfileSnapshot({
        current,
        incoming: result.profileData,
        reasoningSummary: summaryText,
      });
      const version = Math.max(session.profileVersion + 1, (current?.version ?? 0) + 1, 1);
      const saved = await this.profiles.upsert(sessionId, {
        ...merged,
        version,
      });

      console.log('[DEBUG ProfileService] createRevision - reasoningText length:', result.reasoning?.length);
      console.log('[DEBUG ProfileService] createRevision - reasoningText preview:', result.reasoning?.slice(0, 100));

      const revision = await this.profiles.createRevision({
        sessionId,
        source: 'reasoner',
        snapshot: {
          age: saved.age,
          hometown: saved.hometown,
          currentCity: saved.currentCity,
          personality: saved.personality,
          expectations: saved.expectations,
          confidence: saved.confidence,
          reasoningSummary: saved.reasoningSummary,
          version: saved.version,
          finalOutputText: result.finalOutputText || saved.reasoningSummary,
        },
        reasoningText: result.reasoning,
      });

      await this.reasonerJobs.markCompleted(job.id, revision.id);
      await this.sessions.markReasonerCompleted(sessionId, version, detectMinorFlag(saved));

      return { jobId: job.id, profile: saved, revision };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown reasoner error';
      await this.reasonerJobs.markFailed(job.id, message);
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
    onReasoningChunk?: (chunk: string) => void
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

    return this.analyzeProfile(sessionId, triggerType, onReasoningChunk);
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

  private async ensureSessionExists(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    return session;
  }
}

function detectMinorFlag(profile: ProfileSnapshot | null) {
  if (!profile?.age) {
    return false;
  }

  return /(未成年|1[0-7]岁|小学|初中|高中)/.test(profile.age);
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
