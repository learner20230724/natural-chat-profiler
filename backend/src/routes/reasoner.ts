import { Router } from 'express';
import { reasonerStreamRegistry } from '../infrastructure/ReasonerStreamRegistry';

export default function createReasonerRouter() {
  const router = Router();

  /**
   * Persistent SSE connection for reasoner events.
   * The client connects once per session and keeps this alive.
   * Background reasoner tasks push events here instead of through the chat SSE.
   */
  router.get('/:sessionId/reasoner/stream', (req, res) => {
    const { sessionId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send an initial ping so the client knows the connection is live.
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    reasonerStreamRegistry.register(sessionId, res);

    const cleanup = () => {
      reasonerStreamRegistry.unregister(sessionId, res);
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
  });

  return router;
}
