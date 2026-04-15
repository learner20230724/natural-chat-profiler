import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabaseConnection, DatabaseExecutor, DatabasePool } from '../db/mysql';
import { MessageRole, SessionMessageRecord } from '../../types';

interface MessageRow extends mysql.RowDataPacket {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  sequence_no: number;
  created_at: Date;
  model_name: string | null;
  stream_completed: number;
}

export class MessageRepository {
  constructor(private readonly pool: DatabasePool) {}

  async listBySession(sessionId: string) {
    const [rows] = await this.pool.query<MessageRow[]>(
      'SELECT * FROM session_messages WHERE session_id = ? ORDER BY sequence_no ASC',
      [sessionId]
    );
    return rows.map(mapMessage);
  }

  async create(
    params: {
      sessionId: string;
      role: MessageRole;
      content: string;
      modelName?: string | null;
      streamCompleted?: boolean;
    },
    executor: DatabaseExecutor = this.pool
  ) {
    const id = randomUUID();
    const sequenceNo = await this.nextSequenceNoForInsert(params.sessionId, executor);

    await executor.query(
      `INSERT INTO session_messages (id, session_id, role, content, sequence_no, model_name, stream_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.sessionId,
        params.role,
        params.content,
        sequenceNo,
        params.modelName ?? null,
        params.streamCompleted ?? true,
      ]
    );

    return {
      id,
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      sequenceNo,
      createdAt: new Date(),
      modelName: params.modelName ?? null,
      streamCompleted: params.streamCompleted ?? true,
    } satisfies SessionMessageRecord;
  }

  async updateContent(
    id: string,
    params: {
      content: string;
      streamCompleted: boolean;
    },
    executor: DatabaseExecutor = this.pool
  ) {
    await executor.query(
      `UPDATE session_messages
       SET content = ?,
           stream_completed = ?
       WHERE id = ?`,
      [params.content, params.streamCompleted, id]
    );
  }

  async deleteById(id: string) {
    await this.pool.query('DELETE FROM session_messages WHERE id = ?', [id]);
  }

  async countBySession(sessionId: string) {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM session_messages WHERE session_id = ?',
      [sessionId]
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async nextSequenceNoForInsert(sessionId: string, executor: DatabaseExecutor) {
    if (isDatabaseConnection(executor)) {
      const [rows] = await executor.query<mysql.RowDataPacket[]>(
        `SELECT COALESCE(MAX(sequence_no), 0) + 1 AS nextSequenceNo
         FROM session_messages
         WHERE session_id = ?
         FOR UPDATE`,
        [sessionId]
      );
      return Number(rows[0]?.nextSequenceNo ?? 1);
    }

    const [rows] = await executor.query<mysql.RowDataPacket[]>(
      'SELECT COALESCE(MAX(sequence_no), 0) + 1 AS nextSequenceNo FROM session_messages WHERE session_id = ?',
      [sessionId]
    );
    return Number(rows[0]?.nextSequenceNo ?? 1);
  }
}

function isDatabaseConnection(executor: DatabaseExecutor): executor is DatabaseConnection {
  return 'beginTransaction' in executor;
}

function mapMessage(row: MessageRow): SessionMessageRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    sequenceNo: row.sequence_no,
    createdAt: new Date(row.created_at),
    modelName: row.model_name,
    streamCompleted: Boolean(row.stream_completed),
  };
}
