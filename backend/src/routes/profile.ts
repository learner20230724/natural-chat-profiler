import { Router } from 'express';
import { ProfileService } from '../services/ProfileService';
import { asyncHandler } from '../shared/http';
import { successResponse } from '../shared/api';
import { ValidationError } from '../shared/errors';

export default function createProfileRouter(profileService: ProfileService, includeJobRoutes = false) {
  const router = Router();

  if (includeJobRoutes) {
    router.get(
      '/reasoner-jobs/:jobId',
      asyncHandler(async (req, res) => {
        const job = await profileService.getJob(req.params.jobId);
        res.json(successResponse(job));
      })
    );

    return router;
  }

  router.get(
    '/:sessionId/profile',
    asyncHandler(async (req, res) => {
      const profile = await profileService.getProfile(req.params.sessionId);
      res.json(successResponse(profile));
    })
  );

  router.patch(
    '/:sessionId/profile',
    asyncHandler(async (req, res) => {
      if (!req.body || Object.keys(req.body).length === 0) {
        throw new ValidationError('No profile fields provided');
      }

      const profile = await profileService.updateProfile(req.params.sessionId, req.body);
      res.json(successResponse(profile));
    })
  );

  router.get(
    '/:sessionId/profile/revisions',
    asyncHandler(async (req, res) => {
      const revisions = await profileService.listRevisions(req.params.sessionId);
      res.json(successResponse(revisions));
    })
  );

  router.post(
    '/:sessionId/profile/analyze',
    asyncHandler(async (req, res) => {
      const result = await profileService.analyzeProfile(req.params.sessionId, 'manual');
      res.json(successResponse(result));
    })
  );

  router.get(
    '/:sessionId/reasoner-jobs',
    asyncHandler(async (req, res) => {
      const jobs = await profileService.listJobs(req.params.sessionId);
      res.json(successResponse(jobs));
    })
  );

  return router;
}
