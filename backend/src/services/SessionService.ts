import { buildSessionPreview } from '../domain/sessionPolicy';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { MessageRepository } from '../infrastructure/repositories/MessageRepository';
import { ProfileRepository } from '../infrastructure/repositories/ProfileRepository';
import { PrivacyEventRepository } from '../infrastructure/repositories/PrivacyEventRepository';
import { SessionTitleService } from './SessionTitleService';
import { NotFoundError } from '../shared/errors';

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
      session,
      messages,
      profile,
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
      metadata: { scope: 'single_session' },
    });
    await this.sessions.hardDelete(sessionId);
  }

  async clearAllData() {
    await this.privacyEvents.create({
      sessionId: null,
      eventType: 'clear_all',
      metadata: { scope: 'all_sessions' },
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

      if (messages.length === 0) {
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
