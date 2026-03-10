import { Router } from 'express';
import { SessionService } from '../services/SessionService';
import { asyncHandler } from '../shared/http';
import { successResponse } from '../shared/api';

export default function createSessionsRouter(sessionService: SessionService) {
  const router = Router();

  router.delete(
    '/data',
    asyncHandler(async (_req, res) => {
      await sessionService.clearAllData();
      res.json(successResponse({ cleared: true }));
    })
  );

  router.post(
    '/organize',
    asyncHandler(async (_req, res) => {
      const result = await sessionService.organizeSessions();
      res.json(successResponse(result));
    })
  );

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const sessions = await sessionService.listSessions();
      res.json(successResponse(sessions));
    })
  );

  router.post(
    '/',
    asyncHandler(async (_req, res) => {
      const session = await sessionService.createSession();
      res.status(201).json(successResponse(session));
    })
  );

  router.get(
    '/:sessionId',
    asyncHandler(async (req, res) => {
      const detail = await sessionService.getSession(req.params.sessionId);
      res.json(successResponse(detail));
    })
  );

  router.delete(
    '/:sessionId',
    asyncHandler(async (req, res) => {
      await sessionService.deleteSession(req.params.sessionId);
      res.json(successResponse({ sessionId: req.params.sessionId }));
    })
  );

  router.post(
    '/:sessionId/title',
    asyncHandler(async (req, res) => {
      const session = await sessionService.generateTitle(req.params.sessionId);
      res.json(successResponse(session));
    })
  );

  return router;
}
