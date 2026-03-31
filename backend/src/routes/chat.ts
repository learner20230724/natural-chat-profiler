import { Router } from 'express';
import { ChatService } from '../services/ChatService';
import { ProfileService } from '../services/ProfileService';
import { ValidationError } from '../shared/errors';
import { asyncHandler } from '../shared/http';
import { successResponse } from '../shared/api';

export default function createChatRouter(chatService: ChatService, profileService: ProfileService) {
  const router = Router();

  router.get(
    '/:sessionId/messages',
    asyncHandler(async (req, res) => {
      const messages = await chatService.listMessages(req.params.sessionId);
      res.json(successResponse(messages));
    })
  );

  router.post('/:sessionId/chat', async (req, res, next) => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const writeEvent = (payload: unknown) => {
      if (signal.aborted || res.writableEnded || res.destroyed) {
        return;
      }

      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // ignore write errors on closed connections
      }
    };

    let closed = false;
    const onClose = () => {
      if (closed) return;
      closed = true;
      abortController.abort();
    };

    req.on('aborted', onClose);
    req.on('close', onClose);
    res.on('close', onClose);
    res.on('finish', onClose);

    try {
      const { content } = req.body as { content?: string };
      if (!content || typeof content !== 'string') {
        throw new ValidationError('Message content is required');
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const writeEvent = (payload: unknown) => {
        if (signal.aborted || res.writableEnded || res.destroyed) {
          return;
        }

        try {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch {
          // ignore write errors on closed connections
        }
      };

      await chatService.sendMessage(
        req.params.sessionId,
        content,
        (chunk) => {
          writeEvent({ type: 'assistant_chunk', content: chunk });
        },
        { signal }
      );

      if (signal.aborted) {
        return;
      }

      const autoAnalysis = await profileService.maybeAnalyzeProfile(
        req.params.sessionId,
        (chunk) => writeEvent({ type: 'reasoner_chunk', content: chunk }),
        {
          signal,
          onStarted: () => writeEvent({ type: 'reasoner_started' }),
        }
      );

      if (signal.aborted) {
        return;
      }

      if (autoAnalysis) {
        writeEvent({ type: 'profile_updated', data: autoAnalysis.profile });
        writeEvent({
          type: 'reasoner_completed',
          jobId: autoAnalysis.jobId,
          data: autoAnalysis.revision,
          reasoningText: autoAnalysis.revision.reasoningText,
          finalOutputText:
            autoAnalysis.revision.profileSnapshot.finalOutputText ||
            autoAnalysis.revision.profileSnapshot.reasoningSummary ||
            null,
        });
      }

      if (signal.aborted) {
        return;
      }

      writeEvent({ type: 'assistant_done' });
      writeEvent({ type: 'done' });
      res.end();
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      if (!res.headersSent) {
        next(error);
        return;
      }

      writeEvent({ type: 'error', error: error instanceof Error ? error.message : 'Failed to process message' });
      writeEvent({ type: 'done' });
      res.end();
    }
  });

  return router;
}
