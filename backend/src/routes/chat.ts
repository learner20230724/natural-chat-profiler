import { Router } from 'express';
import { ChatService } from '../services/ChatService';
import { ProfileService } from '../services/ProfileService';
import { ValidationError } from '../shared/errors';
import { asyncHandler } from '../shared/http';
import { successResponse } from '../shared/api';
import { reasonerStreamRegistry } from '../infrastructure/ReasonerStreamRegistry';

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

    let closed = false;
    const onClose = () => {
      if (closed) return;
      closed = true;
      abortController.abort();
    };

    req.on('aborted', onClose);
    res.on('close', onClose);

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

    try {
      const { content } = req.body as { content?: string };
      if (!content || typeof content !== 'string') {
        throw new ValidationError('Message content is required');
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

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

      writeEvent({ type: 'assistant_done' });
      writeEvent({ type: 'done' });
      res.end();

      // Reasoner runs entirely in the background after chat SSE is closed.
      // Results are pushed to the persistent reasoner/stream connection.
      const { sessionId } = req.params;
      void (async () => {
        try {
          const maybeResult = await profileService.maybeAnalyzeProfile(
            sessionId,
            (chunk) => {
              console.log('[reasoner] chunk:', chunk.slice(0, 50));
              reasonerStreamRegistry.send(sessionId, { type: 'reasoner_chunk', content: chunk });
            },
            {
              onStarted: () => {
                console.log('[reasoner] started');
                reasonerStreamRegistry.send(sessionId, { type: 'reasoner_started' });
              },
            }
          );

          if (maybeResult) {
            reasonerStreamRegistry.send(sessionId, { type: 'profile_updated', data: maybeResult.profile });
            reasonerStreamRegistry.send(sessionId, {
              type: 'reasoner_completed',
              finalOutputText: maybeResult.revision.profileSnapshot.finalOutputText ?? null,
              reasoningText: maybeResult.revision.reasoningText ?? null,
            });
          }
        } catch (error) {
          console.error('[reasoner] background task error:', error);
          reasonerStreamRegistry.send(sessionId, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Reasoner failed',
          });
        }
      })();
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
