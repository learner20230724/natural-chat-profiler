import { randomUUID } from 'crypto';
import { DatabasePool } from '../db/mysql';
import { PrivacyEventRecord, PrivacyEventType } from '../../types';

export class PrivacyEventRepository {
  constructor(private readonly pool: DatabasePool) {}

  async create(params: {
    sessionId: string | null;
    eventType: PrivacyEventType;
    metadata?: Record<string, unknown> | null;
  }) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO privacy_events (id, session_id, event_type, metadata_json)
       VALUES (?, ?, ?, ?)`,
      [id, params.sessionId, params.eventType, params.metadata ? JSON.stringify(params.metadata) : null]
    );

    return {
      id,
      sessionId: params.sessionId,
      eventType: params.eventType,
      metadata: params.metadata ?? null,
      createdAt: new Date(),
    } satisfies PrivacyEventRecord;
  }
}
