import express, { Express } from 'express';
import cors from 'cors';
import { AppContainer } from './container';
import { logger } from '../middleware/logger';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import createSessionsRouter from '../routes/sessions';
import createChatRouter from '../routes/chat';
import createProfileRouter from '../routes/profile';
import createExportRouter from '../routes/export';
import createReasonerRouter from '../routes/reasoner';

export function createApp(container: AppContainer): Express {
  const app = express();

  // Disable ETag caching so GET responses always reflect the latest DB state.
  app.set('etag', false);

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(logger);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/sessions', createSessionsRouter(container.services.sessionService));
  app.use('/api/sessions', createChatRouter(container.services.chatService, container.services.profileService));
  app.use('/api/sessions', createProfileRouter(container.services.profileService));
  app.use('/api/sessions', createReasonerRouter());
  app.use(
    '/api/sessions',
    createExportRouter(
      container.services.sessionService,
      container.services.pdfService,
      container.repositories.privacyEvents
    )
  );
  app.use('/api', createProfileRouter(container.services.profileService, true));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
