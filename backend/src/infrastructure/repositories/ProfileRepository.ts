import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabasePool } from '../db/mysql';
import { ProfileRevisionRecord, ProfileSnapshot, RevisionSource } from '../../types';

interface ProfileRow extends mysql.RowDataPacket {
  session_id: string;
  age: string | null;
  hometown: string | null;
  current_city: string | null;
  personality: string | null;
  expectations: string | null;
  confidence_json: string | null;
  reasoning_summary: string | null;
  updated_at: Date;
  version: number;
}

interface RevisionRow extends mysql.RowDataPacket {
  id: string;
  session_id: string;
  source: RevisionSource;
  profile_snapshot_json: string;
  reasoning_text: string | null;
  created_at: Date;
}

export class ProfileRepository {
  constructor(private readonly pool: DatabasePool) {}

  async findBySessionId(sessionId: string) {
    const [rows] = await this.pool.query<ProfileRow[]>('SELECT * FROM session_profiles WHERE session_id = ?', [sessionId]);
    return rows[0] ? mapProfile(rows[0]) : null;
  }

  async upsert(sessionId: string, payload: Omit<ProfileSnapshot, 'sessionId' | 'updatedAt'>) {
    await this.pool.query(
      `INSERT INTO session_profiles (session_id, age, hometown, current_city, personality, expectations, confidence_json, reasoning_summary, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         age = VALUES(age),
         hometown = VALUES(hometown),
         current_city = VALUES(current_city),
         personality = VALUES(personality),
         expectations = VALUES(expectations),
         confidence_json = VALUES(confidence_json),
         reasoning_summary = VALUES(reasoning_summary),
         version = VALUES(version),
         updated_at = CURRENT_TIMESTAMP`,
      [
        sessionId,
        payload.age,
        payload.hometown,
        payload.currentCity,
        payload.personality,
        payload.expectations,
        payload.confidence ? JSON.stringify(payload.confidence) : null,
        payload.reasoningSummary,
        payload.version,
      ]
    );

    const profile = await this.findBySessionId(sessionId);
    if (!profile) {
      throw new Error('Failed to persist profile');
    }
    return profile;
  }

  async createRevision(params: {
    sessionId: string;
    source: RevisionSource;
    snapshot: Omit<ProfileSnapshot, 'sessionId' | 'updatedAt'> & {
      finalOutputText?: string | null;
    };
    reasoningText: string | null;
  }) {
    console.log('[DEBUG ProfileRepository] createRevision - reasoningText length:', params.reasoningText?.length);
    console.log('[DEBUG ProfileRepository] createRevision - reasoningText preview:', params.reasoningText?.slice(0, 100));

    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO profile_revisions (id, session_id, source, profile_snapshot_json, reasoning_text)
       VALUES (?, ?, ?, ?, ?)`,
      [id, params.sessionId, params.source, JSON.stringify(params.snapshot), params.reasoningText]
    );

    return {
      id,
      sessionId: params.sessionId,
      source: params.source,
      profileSnapshot: params.snapshot,
      reasoningText: params.reasoningText,
      finalOutputText: params.snapshot.finalOutputText ?? null,
      createdAt: new Date(),
    } satisfies ProfileRevisionRecord;
  }

  async listRevisions(sessionId: string) {
    const [rows] = await this.pool.query<RevisionRow[]>(
      'SELECT * FROM profile_revisions WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );

    console.log('[DEBUG ProfileRepository] listRevisions - rows count:', rows.length);
    rows.forEach((row, i) => {
      console.log(`[DEBUG ProfileRepository] row ${i} - reasoning_text:`, row.reasoning_text?.slice(0, 100));
    });

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      source: row.source,
      profileSnapshot: JSON.parse(row.profile_snapshot_json),
      reasoningText: row.reasoning_text,
      finalOutputText: (JSON.parse(row.profile_snapshot_json).finalOutputText as string | null | undefined) ?? null,
      createdAt: new Date(row.created_at),
    } satisfies ProfileRevisionRecord));
  }
}

function mapProfile(row: ProfileRow): ProfileSnapshot {
  return {
    sessionId: row.session_id,
    age: row.age,
    hometown: row.hometown,
    currentCity: row.current_city,
    personality: row.personality,
    expectations: row.expectations,
    confidence: row.confidence_json ? JSON.parse(row.confidence_json) : null,
    reasoningSummary: row.reasoning_summary,
    updatedAt: new Date(row.updated_at),
    version: row.version,
  };
}
