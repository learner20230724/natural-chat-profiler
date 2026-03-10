import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabasePool } from '../db/mysql';
import { SessionSummaryRecord } from '../../types';

interface SummaryRow extends mysql.RowDataPacket {
  id: string;
  session_id: string;
  summary_text: string;
  covered_until_sequence: number;
  created_at: Date;
}

export class SummaryRepository {
  constructor(private readonly pool: DatabasePool) {}

  async listBySession(sessionId: string) {
    const [rows] = await this.pool.query<SummaryRow[]>(
      'SELECT * FROM session_summaries WHERE session_id = ? ORDER BY covered_until_sequence DESC',
      [sessionId]
    );

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      summaryText: row.summary_text,
      coveredUntilSequence: row.covered_until_sequence,
      createdAt: new Date(row.created_at),
    } satisfies SessionSummaryRecord));
  }

  async create(sessionId: string, summaryText: string, coveredUntilSequence: number) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO session_summaries (id, session_id, summary_text, covered_until_sequence)
       VALUES (?, ?, ?, ?)`,
      [id, sessionId, summaryText, coveredUntilSequence]
    );
  }
}
