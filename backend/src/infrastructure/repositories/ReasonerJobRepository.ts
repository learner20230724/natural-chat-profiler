import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { DatabaseExecutor, DatabasePool } from '../db/mysql';
import { ReasonerJobRecord, ReasonerJobStatus, ReasonerTriggerType } from '../../types';

interface JobRow extends mysql.RowDataPacket {
  id: string;
  session_id: string;
  trigger_type: ReasonerTriggerType;
  status: ReasonerJobStatus;
  started_at: Date | null;
  finished_at: Date | null;
  error_message: string | null;
  result_revision_id: string | null;
  created_at: Date;
}

export class ReasonerJobRepository {
  constructor(private readonly pool: DatabasePool) {}

  async create(sessionId: string, triggerType: ReasonerTriggerType) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO reasoner_jobs (id, session_id, trigger_type, status)
       VALUES (?, ?, ?, 'pending')`,
      [id, sessionId, triggerType]
    );
    const job = await this.findById(id);
    if (!job) {
      throw new Error('Failed to create reasoner job');
    }
    return job;
  }

  async findById(id: string) {
    const [rows] = await this.pool.query<JobRow[]>('SELECT * FROM reasoner_jobs WHERE id = ?', [id]);
    return rows[0] ? mapJob(rows[0]) : null;
  }

  async listBySession(sessionId: string) {
    const [rows] = await this.pool.query<JobRow[]>(
      'SELECT * FROM reasoner_jobs WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );
    return rows.map(mapJob);
  }

  async hasRunningJob(sessionId: string) {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM reasoner_jobs
       WHERE session_id = ? AND status IN ('pending', 'running')
         AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)`,
      [sessionId]
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async markRunning(id: string, executor: DatabaseExecutor = this.pool) {
    await executor.query(
      `UPDATE reasoner_jobs SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  }

  async markCompleted(id: string, revisionId: string | null, executor: DatabaseExecutor = this.pool) {
    await executor.query(
      `UPDATE reasoner_jobs
       SET status = 'completed', finished_at = CURRENT_TIMESTAMP, result_revision_id = ?
       WHERE id = ?`,
      [revisionId, id]
    );
  }

  async markFailed(id: string, errorMessage: string, executor: DatabaseExecutor = this.pool) {
    await executor.query(
      `UPDATE reasoner_jobs
       SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_message = ?
       WHERE id = ?`,
      [errorMessage, id]
    );
  }
}

function mapJob(row: JobRow): ReasonerJobRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    triggerType: row.trigger_type,
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    errorMessage: row.error_message,
    resultRevisionId: row.result_revision_id,
    createdAt: new Date(row.created_at),
  };
}
