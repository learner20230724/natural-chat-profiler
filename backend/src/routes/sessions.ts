import { Router } from 'express';
import { SessionService } from '../services/SessionService';
import { asyncHandler } from '../shared/http';
import { successResponse } from '../shared/api';
import { ValidationError } from '../shared/errors';
import { ProfileFieldDefinition } from '../types';

const PROFILE_FIELD_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{1,50}$/;
const MAX_PROFILE_FIELDS = 50;

function normalizeProfileFieldDefinition(raw: ProfileFieldDefinition) {
  return {
    key: raw.key.trim(),
    label: raw.label.trim(),
    placeholder: raw.placeholder?.trim() || null,
    promptHint: raw.promptHint?.trim() || null,
  } satisfies ProfileFieldDefinition;
}

function validateProfileFieldDefinitions(definitions: ProfileFieldDefinition[]) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new ValidationError('字段定义不能为空');
  }

  if (definitions.length > MAX_PROFILE_FIELDS) {
    throw new ValidationError(`字段数量不能超过 ${MAX_PROFILE_FIELDS}`);
  }

  const keys = new Set<string>();
  for (const field of definitions) {
    if (!field.key || !PROFILE_FIELD_KEY_REGEX.test(field.key)) {
      throw new ValidationError('字段 key 必须是字母开头的字母数字下划线组合');
    }

    if (!field.label || !field.label.trim()) {
      throw new ValidationError('字段 label 不能为空');
    }

    if (keys.has(field.key)) {
      throw new ValidationError(`字段 key 重复: ${field.key}`);
    }

    keys.add(field.key);
  }
}

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

  router.get(
    '/:sessionId/profile-fields',
    asyncHandler(async (req, res) => {
      const fields = await sessionService.getProfileFieldDefinitions(req.params.sessionId);
      res.json(successResponse(fields));
    })
  );

  router.put(
    '/:sessionId/profile-fields',
    asyncHandler(async (req, res) => {
      if (!Array.isArray(req.body)) {
        throw new ValidationError('字段定义格式不正确');
      }

      const normalized = req.body.map((field: ProfileFieldDefinition) => normalizeProfileFieldDefinition(field));
      validateProfileFieldDefinitions(normalized);

      const updated = await sessionService.updateProfileFieldDefinitions(req.params.sessionId, normalized);
      res.json(successResponse(updated));
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
