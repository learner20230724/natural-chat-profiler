import type { Response } from 'express';

type ReasonerEvent =
  | { type: 'reasoner_started' }
  | { type: 'reasoner_chunk'; content: string }
  | { type: 'reasoner_completed'; finalOutputText: string | null; reasoningText: string | null }
  | { type: 'profile_updated'; data: unknown }
  | { type: 'done' }
  | { type: 'error'; error: string };

/**
 * Singleton registry that maps sessionId → active SSE response.
 * The reasoner background task writes events here after the chat SSE has closed.
 */
export class ReasonerStreamRegistry {
  private readonly connections = new Map<string, Response>();

  register(sessionId: string, res: Response): void {
    // Close any previous connection for this session before registering the new one.
    this.close(sessionId);
    this.connections.set(sessionId, res);
  }

  unregister(sessionId: string, res: Response): void {
    if (this.connections.get(sessionId) === res) {
      this.connections.delete(sessionId);
    }
  }

  send(sessionId: string, event: ReasonerEvent): void {
    const res = this.connections.get(sessionId);
    if (!res || res.writableEnded || res.destroyed) {
      return;
    }
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // ignore write errors on closed connections
    }
  }

  close(sessionId: string): void {
    const res = this.connections.get(sessionId);
    if (res && !res.writableEnded && !res.destroyed) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    this.connections.delete(sessionId);
  }

  hasConnection(sessionId: string): boolean {
    const res = this.connections.get(sessionId);
    return !!res && !res.writableEnded && !res.destroyed;
  }
}

export const reasonerStreamRegistry = new ReasonerStreamRegistry();
