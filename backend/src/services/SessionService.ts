import { buildSessionPreview } from '../domain/sessionPolicy';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { MessageRepository } from '../infrastructure/repositories/MessageRepository';
import { ProfileRepository } from '../infrastructure/repositories/ProfileRepository';
import { PrivacyEventRepository } from '../infrastructure/repositories/PrivacyEventRepository';
import { SessionTitleService } from './SessionTitleService';
import { NotFoundError } from '../shared/errors';
import { ProfileFieldDefinition } from '../types';
import { DEFAULT_REASONER_MESSAGE_THRESHOLD } from '../domain/reasonerPolicy';

const AUTO_DELETE_EMPTY_SESSION_GRACE_MS = 60 * 1000;

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly messages: MessageRepository,
    private readonly profiles: ProfileRepository,
    private readonly privacyEvents: PrivacyEventRepository,
    private readonly titleService: SessionTitleService
  ) {}

  async createSession() {
    const session = await this.sessions.create();
    return {
      ...session,
      preview: buildSessionPreview(session),
    };
  }

  async listSessions() {
    const sessions = await this.sessions.listActive();
    return sessions.map((session) => ({
      ...session,
      preview: buildSessionPreview(session),
    }));
  }

  async getSession(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    const [messages, profile] = await Promise.all([
      this.messages.listBySession(sessionId),
      this.profiles.findBySessionId(sessionId),
    ]);

    return {
      session: {
        ...session,
        preview: buildSessionPreview(session),
      },
      messages,
      profile,
      profileFieldDefinitions: session.profileFieldDefinitions,
    };
  }

  async deleteSession(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    await this.privacyEvents.create({
      sessionId,
      eventType: 'clear_session',
      metadata: { scope: 'single_session', deletionMode: 'soft' },
    });
    await this.sessions.clearPrivacyData(sessionId);
  }

  async clearAllData() {
    await this.privacyEvents.create({
      sessionId: null,
      eventType: 'clear_all',
      metadata: { scope: 'all_sessions', deletionMode: 'hard' },
    });
    await this.sessions.clearAll();
  }

  async generateTitle(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    const [messages, profile] = await Promise.all([
      this.messages.listBySession(sessionId),
      this.profiles.findBySessionId(sessionId),
    ]);

    const title = await this.titleService.generateTitle(messages, profile);
    if (title) {
      await this.sessions.updateTitle(sessionId, title);
    }

    const updated = await this.sessions.findById(sessionId);
    if (!updated) {
      throw new NotFoundError('Session not found after title generation');
    }

    return {
      ...updated,
      preview: buildSessionPreview(updated),
    };
  }

  async organizeSessions() {
    const sessions = await this.sessions.listActive();
    let deletedCount = 0;
    let renamedCount = 0;

    for (const session of sessions) {
      const [messages, profile] = await Promise.all([
        this.messages.listBySession(session.id),
        this.profiles.findBySessionId(session.id),
      ]);

      if (session.isInitializing) {
        continue;
      }

      if (messages.length === 0) {
        const isRecentEmptySession = Date.now() - session.createdAt.getTime() < AUTO_DELETE_EMPTY_SESSION_GRACE_MS;
        if (isRecentEmptySession) {
          continue;
        }

        await this.sessions.hardDelete(session.id);
        deletedCount += 1;
        continue;
      }

      if (!shouldAutoRenameTitle(session.title)) {
        continue;
      }

      const aiTitle = await this.titleService.generateTitle(messages, profile);
      if (!aiTitle) {
        continue;
      }

      await this.sessions.updateTitle(session.id, `${formatSessionDate(session.lastMessageAt ?? session.createdAt)}-${aiTitle}`);
      renamedCount += 1;
    }

    const updatedSessions = await this.listSessions();
    return {
      sessions: updatedSessions,
      deletedCount,
      renamedCount,
    };
  }

  async getProfileFieldDefinitions(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    return session.profileFieldDefinitions;
  }

  async updateProfileFieldDefinitions(sessionId: string, definitions: ProfileFieldDefinition[]) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    await this.sessions.updateProfileFields(sessionId, definitions);
    // Ensure the reasoner fires on the very next message so it immediately
    // incorporates any newly added or removed fields.
    await this.sessions.forceReasonerOnNextMessage(sessionId, DEFAULT_REASONER_MESSAGE_THRESHOLD);
    return definitions;
  }
}

function shouldAutoRenameTitle(title: string | null) {
  if (!title) {
    return true;
  }

  const normalized = title.trim();
  if (!normalized) {
    return true;
  }

  return /^新会话(?:\s*[·.-].*)?$/i.test(normalized) || /^未命名(?:会话)?$/i.test(normalized);
}

function formatSessionDate(date: Date) {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
}
