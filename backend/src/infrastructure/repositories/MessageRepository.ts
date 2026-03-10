import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabasePool } from '../db/mysql';
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

  async create(params: {
    sessionId: string;
    role: MessageRole;
    content: string;
    modelName?: string | null;
    streamCompleted?: boolean;
  }) {
    const id = randomUUID();
    const sequenceNo = await this.nextSequenceNo(params.sessionId);

    await this.pool.query(
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

  async countBySession(sessionId: string) {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM session_messages WHERE session_id = ?',
      [sessionId]
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async nextSequenceNo(sessionId: string) {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT COALESCE(MAX(sequence_no), 0) + 1 AS nextSequenceNo FROM session_messages WHERE session_id = ?',
      [sessionId]
    );
    return Number(rows[0]?.nextSequenceNo ?? 1);
  }
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
