import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabaseConnection, DatabaseExecutor, DatabasePool } from '../db/mysql';
import { ProfileFieldDefinition, SessionRecord, SessionStatus } from '../../types';

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
  is_initializing: number;
  profile_fields_json: string | null;
}

export interface CreateSessionInput {
  title?: string | null;
  profileFieldDefinitions?: ProfileFieldDefinition[];
}

const DEFAULT_PROFILE_FIELDS: ProfileFieldDefinition[] = [
  { key: 'age', label: '年龄', placeholder: '待了解' },
  { key: 'hometown', label: '家庭所在城市', placeholder: '待了解' },
  { key: 'currentCity', label: '现居城市', placeholder: '待了解' },
  { key: 'personality', label: '性格特征', placeholder: '待了解' },
  { key: 'expectations', label: '期待的对象特征', placeholder: '待了解' },
];

export function getDefaultProfileFields() {
  return DEFAULT_PROFILE_FIELDS.map((field) => ({ ...field }));
}

export class SessionRepository {
  constructor(private readonly pool: DatabasePool) {}

  async create(input: CreateSessionInput = {}) {
    const id = randomUUID();
    const profileFields = input.profileFieldDefinitions ?? getDefaultProfileFields();
    await this.pool.query('INSERT INTO sessions (id, title, profile_fields_json) VALUES (?, ?, ?)', [
      id,
      input.title ?? null,
      JSON.stringify(profileFields),
    ]);
    const session = await this.findById(id);

    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}) {
    const [rows] = await this.pool.query<SessionRow[]>(
      `SELECT * FROM sessions WHERE id = ? ${options.includeDeleted ? '' : "AND status != 'deleted'"}`,
      [id]
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async listActive() {
    const [rows] = await this.pool.query<SessionRow[]>(
      `SELECT * FROM sessions WHERE status != 'deleted' ORDER BY COALESCE(last_message_at, updated_at) DESC, created_at DESC`
    );
    return rows.map(mapSession);
  }

  async lockById(id: string, connection: DatabaseConnection) {
    const [rows] = await connection.query<SessionRow[]>('SELECT * FROM sessions WHERE id = ? FOR UPDATE', [id]);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async updateTitle(id: string, title: string | null) {
    await this.pool.query('UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, id]);
  }

  async updateProfileFields(id: string, profileFieldDefinitions: ProfileFieldDefinition[]) {
    await this.pool.query(
      'UPDATE sessions SET profile_fields_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(profileFieldDefinitions), id]
    );
  }

  /**
   * Force the reasoner to trigger on the next incoming message by setting
   * messageCountSinceReasoner to the given threshold value.
   */
  async forceReasonerOnNextMessage(id: string, threshold: number) {
    await this.pool.query(
      `UPDATE sessions
       SET message_count_since_reasoner = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [threshold, id]
    );
  }

  async incrementMessageCounter(id: string, executor: DatabaseExecutor = this.pool) {
    await executor.query(
      `UPDATE sessions
       SET message_count_since_reasoner = message_count_since_reasoner + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  }

  async markReasonerCompleted(
    id: string,
    profileVersion: number,
    isMinorFlagged: boolean,
    executor: DatabaseExecutor = this.pool
  ) {
    await executor.query(
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

  async clearPrivacyData(id: string) {
    await this.pool.query(
      `UPDATE sessions
       SET privacy_cleared_at = CURRENT_TIMESTAMP,
           status = 'deleted',
           title = NULL,
           is_initializing = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  }

  async clearInitializing(id: string, executor: DatabaseExecutor = this.pool) {
    await executor.query(
      `UPDATE sessions
       SET is_initializing = FALSE,
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

function safeJsonParse(value: string | unknown[] | null | undefined): unknown | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value as string) as unknown;
  } catch {
    return null;
  }
}

function isProfileFieldDefinition(value: unknown): value is ProfileFieldDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.key === 'string' && typeof record.label === 'string';
}

function parseProfileFieldDefinitions(raw: string | null): ProfileFieldDefinition[] {
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) {
    return DEFAULT_PROFILE_FIELDS;
  }

  const filtered = parsed.filter(isProfileFieldDefinition).map((item) => ({
    key: item.key,
    label: item.label,
    placeholder: typeof item.placeholder === 'string' ? item.placeholder : null,
    promptHint: typeof item.promptHint === 'string' ? item.promptHint : null,
  }));

  return filtered.length > 0 ? filtered : getDefaultProfileFields();
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
    isInitializing: Boolean(row.is_initializing),
    profileFieldDefinitions: parseProfileFieldDefinitions(row.profile_fields_json),
  };
}
