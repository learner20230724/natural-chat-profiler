import { SessionService } from '../services/SessionService';
import { ChatService } from '../services/ChatService';
import { ProfileService } from '../services/ProfileService';
import { PDFService } from '../services/PDFService';
import { createMySqlPool } from '../infrastructure/db/mysql';
import { initializeSchema, SchemaInitializationResult } from '../infrastructure/db/schema';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { MessageRepository } from '../infrastructure/repositories/MessageRepository';
import { ProfileRepository } from '../infrastructure/repositories/ProfileRepository';
import { ReasonerJobRepository } from '../infrastructure/repositories/ReasonerJobRepository';
import { PrivacyEventRepository } from '../infrastructure/repositories/PrivacyEventRepository';
import { DeepSeekClient } from '../infrastructure/ai/DeepSeekClient';
import { SessionTitleService } from '../services/SessionTitleService';

export interface AppContainer {
  db: {
    pool: ReturnType<typeof createMySqlPool>;
    initializeSchema: () => Promise<SchemaInitializationResult>;
  };
  repositories: {
    sessions: SessionRepository;
    messages: MessageRepository;
    profiles: ProfileRepository;
    reasonerJobs: ReasonerJobRepository;
    privacyEvents: PrivacyEventRepository;
  };
  services: {
    sessionService: SessionService;
    chatService: ChatService;
    profileService: ProfileService;
    pdfService: PDFService;
  };
}

export function createContainer(): AppContainer {
  const pool = createMySqlPool();
  const sessions = new SessionRepository(pool);
  const messages = new MessageRepository(pool);
  const profiles = new ProfileRepository(pool);
  const reasonerJobs = new ReasonerJobRepository(pool);
  const privacyEvents = new PrivacyEventRepository(pool);
  const aiClient = new DeepSeekClient();
  const titleService = new SessionTitleService(aiClient);

  return {
    db: {
      pool,
      initializeSchema: () => initializeSchema(pool),
    },
    repositories: {
      sessions,
      messages,
      profiles,
      reasonerJobs,
      privacyEvents,
    },
    services: {
      sessionService: new SessionService(sessions, messages, profiles, privacyEvents, titleService),
      chatService: new ChatService(pool, sessions, messages, profiles, aiClient),
      profileService: new ProfileService(pool, sessions, messages, profiles, reasonerJobs, aiClient),
      pdfService: new PDFService(),
    },
  };
}
