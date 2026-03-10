import { MessageRepository } from '../infrastructure/repositories/MessageRepository';
import { ProfileRepository } from '../infrastructure/repositories/ProfileRepository';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { DeepSeekClient } from '../infrastructure/ai/DeepSeekClient';
import { buildChatPrompt } from './ChatPromptBuilder';
import { NotFoundError } from '../shared/errors';

export class ChatService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly messages: MessageRepository,
    private readonly profiles: ProfileRepository,
    private readonly aiClient: DeepSeekClient
  ) {}

  async listMessages(sessionId: string) {
    await this.ensureSessionExists(sessionId);
    return this.messages.listBySession(sessionId);
  }

  async sendMessage(
    sessionId: string,
    userMessage: string,
    onChunk?: (chunk: string) => void
  ) {
    await this.ensureSessionExists(sessionId);

    await this.messages.create({
      sessionId,
      role: 'user',
      content: userMessage,
      modelName: null,
    });
    await this.sessions.incrementMessageCounter(sessionId);

    const [messageHistory, profile] = await Promise.all([
      this.messages.listBySession(sessionId),
      this.profiles.findBySessionId(sessionId),
    ]);

    const assistantContent = await this.aiClient.streamChat(
      buildChatPrompt(messageHistory, profile),
      onChunk
    );

    const assistantMessage = await this.messages.create({
      sessionId,
      role: 'assistant',
      content: assistantContent,
      modelName: 'deepseek-chat',
      streamCompleted: true,
    });

    return {
      assistantMessage,
      profile,
    };
  }

  private async ensureSessionExists(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    return session;
  }
}
