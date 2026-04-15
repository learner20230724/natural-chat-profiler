import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabaseExecutor, DatabasePool } from '../db/mysql';
import { ProfileRevisionRecord, ProfileSnapshot, RevisionSource } from '../../types';

interface ProfileRow extends mysql.RowDataPacket {
  session_id: string;
  age: string | null;
  hometown: string | null;
  current_city: string | null;
  personality: string | null;
  expectations: string | null;
  profile_json: string | Record<string, unknown> | null;
  confidence_json: string | Record<string, unknown> | null;
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

  async findBySessionId(sessionId: string, executor: DatabaseExecutor = this.pool) {
    const [rows] = await executor.query<ProfileRow[]>('SELECT * FROM session_profiles WHERE session_id = ?', [sessionId]);
    return rows[0] ? mapProfile(rows[0]) : null;
  }

  async upsert(
    sessionId: string,
    payload: Omit<ProfileSnapshot, 'sessionId' | 'updatedAt'>,
    executor: DatabaseExecutor = this.pool
  ) {
    await executor.query(
      `INSERT INTO session_profiles (session_id, profile_json, confidence_json, reasoning_summary, version)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         profile_json = VALUES(profile_json),
         confidence_json = VALUES(confidence_json),
         reasoning_summary = VALUES(reasoning_summary),
         version = VALUES(version),
         updated_at = CURRENT_TIMESTAMP`,
      [
        sessionId,
        JSON.stringify(payload.values ?? {}),
        payload.confidence ? JSON.stringify(payload.confidence) : null,
        payload.reasoningSummary,
        payload.version,
      ]
    );

    const profile = await this.findBySessionId(sessionId, executor);
    if (!profile) {
      throw new Error('Failed to persist profile');
    }
    return profile;
  }

  async createRevision(
    params: {
      sessionId: string;
      source: RevisionSource;
      snapshot: Omit<ProfileSnapshot, 'sessionId' | 'updatedAt'> & {
        finalOutputText?: string | null;
      };
      reasoningText: string | null;
    },
    executor: DatabaseExecutor = this.pool
  ) {
    const id = randomUUID();
    await executor.query(
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

  async listRevisions(sessionId: string, executor: DatabaseExecutor = this.pool) {
    const [rows] = await executor.query<RevisionRow[]>(
      'SELECT * FROM profile_revisions WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );

    return rows.map((row) => {
      const parsed = safeJsonParse(row.profile_snapshot_json);
      const profileSnapshot = coerceProfileSnapshot(parsed);

      return {
        id: row.id,
        sessionId: row.session_id,
        source: row.source,
        profileSnapshot,
        reasoningText: row.reasoning_text,
        finalOutputText: profileSnapshot.finalOutputText ?? null,
        createdAt: new Date(row.created_at),
      } satisfies ProfileRevisionRecord;
    });
  }
}

function safeJsonParse(value: string | Record<string, unknown> | null | undefined): unknown | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function coerceProfileSnapshot(value: unknown): ProfileRevisionRecord['profileSnapshot'] {
  if (!isRecord(value)) {
    return emptyRevisionSnapshot();
  }

  if (isRecord(value.values)) {
    return {
      values: mapValues(value.values),
      confidence: isRecord(value.confidence) ? (value.confidence as Record<string, number>) : null,
      reasoningSummary: typeof value.reasoningSummary === 'string' ? value.reasoningSummary : null,
      version: typeof value.version === 'number' && Number.isFinite(value.version) ? value.version : 0,
      finalOutputText: typeof value.finalOutputText === 'string' ? value.finalOutputText : null,
    };
  }

  return {
    values: mapValues({
      age: value.age,
      hometown: value.hometown,
      currentCity: value.currentCity,
      personality: value.personality,
      expectations: value.expectations,
    }),
    confidence: isRecord(value.confidence) ? (value.confidence as Record<string, number>) : null,
    reasoningSummary: typeof value.reasoningSummary === 'string' ? value.reasoningSummary : null,
    version: typeof value.version === 'number' && Number.isFinite(value.version) ? value.version : 0,
    finalOutputText: typeof value.finalOutputText === 'string' ? value.finalOutputText : null,
  };
}

function emptyRevisionSnapshot(): ProfileRevisionRecord['profileSnapshot'] {
  return {
    values: {},
    confidence: null,
    reasoningSummary: null,
    version: 0,
    finalOutputText: null,
  };
}

function mapValues(value: Record<string, unknown>) {
  const mapped: Record<string, string | null> = {};
  Object.entries(value).forEach(([key, raw]) => {
    mapped[key] = typeof raw === 'string' && raw.trim() ? raw.trim() : raw == null ? null : String(raw);
  });
  return mapped;
}

function mapProfile(row: ProfileRow): ProfileSnapshot {
  const confidence = safeJsonParse(row.confidence_json);
  const profileJson = safeJsonParse(row.profile_json);

  return {
    sessionId: row.session_id,
    values: isRecord(profileJson)
      ? mapValues(profileJson)
      : mapValues({
          age: row.age,
          hometown: row.hometown,
          currentCity: row.current_city,
          personality: row.personality,
          expectations: row.expectations,
        }),
    confidence: isRecord(confidence) ? (confidence as Record<string, number>) : null,
    reasoningSummary: row.reasoning_summary,
    updatedAt: new Date(row.updated_at),
    version: row.version,
  };
}
