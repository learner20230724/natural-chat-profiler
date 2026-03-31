import { MessageRepository } from '../infrastructure/repositories/MessageRepository';
import { ProfileRepository } from '../infrastructure/repositories/ProfileRepository';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { DeepSeekClient } from '../infrastructure/ai/DeepSeekClient';
import { DatabasePool } from '../infrastructure/db/mysql';
import { buildChatPrompt } from './ChatPromptBuilder';
import { NotFoundError } from '../shared/errors';

export class ChatService {
  constructor(
    private readonly pool: DatabasePool,
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
    onChunk?: (chunk: string) => void,
    options?: {
      signal?: AbortSignal;
    }
  ) {
    const session = await this.runMessageWriteTransaction(sessionId, userMessage);

    const [messageHistory, profile] = await Promise.all([
      this.messages.listBySession(sessionId),
      this.profiles.findBySessionId(sessionId),
    ]);

    const placeholderAssistantMessage = await this.messages.create({
      sessionId,
      role: 'assistant',
      content: '',
      modelName: 'deepseek-chat',
      streamCompleted: false,
    });

    let assistantContent = '';

    try {
      assistantContent = await this.aiClient.streamChat(
        buildChatPrompt(messageHistory, profile, session.profileFieldDefinitions),
        (chunk) => {
          assistantContent += chunk;
          onChunk?.(chunk);
        },
        { signal: options?.signal }
      );
    } catch (error) {
      if (assistantContent) {
        await this.messages.updateContent(placeholderAssistantMessage.id, {
          content: assistantContent,
          streamCompleted: false,
        });
      }
      throw error;
    }

    await this.messages.updateContent(placeholderAssistantMessage.id, {
      content: assistantContent,
      streamCompleted: true,
    });

    return {
      assistantMessage: {
        ...placeholderAssistantMessage,
        content: assistantContent,
        streamCompleted: true,
      },
      profile,
    };
  }

  private async runMessageWriteTransaction(sessionId: string, userMessage: string) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const session = await this.sessions.lockById(sessionId, connection);
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      await this.messages.create(
        {
          sessionId,
          role: 'user',
          content: userMessage,
          modelName: null,
        },
        connection
      );
      await this.sessions.incrementMessageCounter(sessionId, connection);
      await this.sessions.clearInitializing(sessionId, connection);

      await connection.commit();

      return session;
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
