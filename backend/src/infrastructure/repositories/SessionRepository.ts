import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabasePool } from '../db/mysql';
import { SessionRecord, SessionStatus } from '../../types';

interface SessionRow extends mysql.RowDataPacket {
  id: string;
  title: string | null;
  status: SessionStatus;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date | null;
  last_reasoner_run_at: Date | null;
  message_count_since_reasoner: number;
  profile_version: number;
  is_minor_flagged: number;
  privacy_cleared_at: Date | null;
}

export interface CreateSessionInput {
  title?: string | null;
}

export class SessionRepository {
  constructor(private readonly pool: DatabasePool) {}

  async create(input: CreateSessionInput = {}) {
    const id = randomUUID();
    await this.pool.query('INSERT INTO sessions (id, title) VALUES (?, ?)', [id, input.title ?? null]);
    const session = await this.findById(id);

    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  async findById(id: string) {
    const [rows] = await this.pool.query<SessionRow[]>('SELECT * FROM sessions WHERE id = ?', [id]);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async listActive() {
    const [rows] = await this.pool.query<SessionRow[]>(
      `SELECT * FROM sessions WHERE status != 'deleted' ORDER BY COALESCE(last_message_at, updated_at) DESC, created_at DESC`
    );
    return rows.map(mapSession);
  }

  async updateTitle(id: string, title: string | null) {
    await this.pool.query('UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, id]);
  }

  async incrementMessageCounter(id: string) {
    await this.pool.query(
      `UPDATE sessions
       SET message_count_since_reasoner = message_count_since_reasoner + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  }

  async markReasonerCompleted(id: string, profileVersion: number, isMinorFlagged: boolean) {
    await this.pool.query(
      `UPDATE sessions
       SET last_reasoner_run_at = CURRENT_TIMESTAMP,
           message_count_since_reasoner = 0,
           profile_version = ?,
           is_minor_flagged = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [profileVersion, isMinorFlagged, id]
    );
  }

  async markPrivacyCleared(id: string) {
    await this.pool.query(
      `UPDATE sessions
       SET privacy_cleared_at = CURRENT_TIMESTAMP,
           status = 'deleted',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  }

  async hardDelete(id: string) {
    await this.pool.query('DELETE FROM sessions WHERE id = ?', [id]);
  }

  async clearAll() {
    await this.pool.query('DELETE FROM sessions');
  }
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
    lastReasonerRunAt: row.last_reasoner_run_at ? new Date(row.last_reasoner_run_at) : null,
    messageCountSinceReasoner: row.message_count_since_reasoner,
    profileVersion: row.profile_version,
    isMinorFlagged: Boolean(row.is_minor_flagged),
    privacyClearedAt: row.privacy_cleared_at ? new Date(row.privacy_cleared_at) : null,
  };
}
