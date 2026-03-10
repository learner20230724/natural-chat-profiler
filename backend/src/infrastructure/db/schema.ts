import mysql from 'mysql2/promise';
import { DatabasePool } from './mysql';

export async function initializeSchema(pool: DatabasePool) {
  const connection = await pool.getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(200) NULL,
        status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP NULL,
        last_reasoner_run_at TIMESTAMP NULL,
        message_count_since_reasoner INT NOT NULL DEFAULT 0,
        profile_version INT NOT NULL DEFAULT 0,
        is_minor_flagged BOOLEAN NOT NULL DEFAULT FALSE,
        privacy_cleared_at TIMESTAMP NULL,
        INDEX idx_sessions_status_updated (status, updated_at),
        INDEX idx_sessions_last_message (last_message_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await ensureSessionsTableCompatibility(connection);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS session_messages (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant', 'system') NOT NULL,
        content MEDIUMTEXT NOT NULL,
        sequence_no INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        model_name VARCHAR(100) NULL,
        stream_completed BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT fk_session_messages_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT uq_session_sequence UNIQUE (session_id, sequence_no),
        INDEX idx_session_messages_session_seq (session_id, sequence_no),
        INDEX idx_session_messages_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS session_profiles (
        session_id VARCHAR(36) PRIMARY KEY,
        age VARCHAR(50) NULL,
        hometown VARCHAR(100) NULL,
        current_city VARCHAR(100) NULL,
        personality TEXT NULL,
        expectations TEXT NULL,
        confidence_json JSON NULL,
        reasoning_summary TEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        version INT NOT NULL DEFAULT 1,
        CONSTRAINT fk_session_profiles_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS profile_revisions (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        source ENUM('reasoner', 'manual', 'system') NOT NULL,
        profile_snapshot_json JSON NOT NULL,
        reasoning_text MEDIUMTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_profile_revisions_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        INDEX idx_profile_revisions_session_created (session_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reasoner_jobs (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        trigger_type ENUM('message_threshold', 'timer', 'manual') NOT NULL,
        status ENUM('pending', 'running', 'completed', 'failed') NOT NULL,
        started_at TIMESTAMP NULL,
        finished_at TIMESTAMP NULL,
        error_message TEXT NULL,
        result_revision_id VARCHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_reasoner_jobs_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        INDEX idx_reasoner_jobs_session_created (session_id, created_at),
        INDEX idx_reasoner_jobs_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS session_summaries (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        summary_text MEDIUMTEXT NOT NULL,
        covered_until_sequence INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_session_summaries_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        INDEX idx_session_summaries_session_created (session_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS privacy_events (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NULL,
        event_type ENUM('clear_session', 'clear_all', 'export_pdf') NOT NULL,
        metadata_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_privacy_events_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
        INDEX idx_privacy_events_created (created_at),
        INDEX idx_privacy_events_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    connection.release();
  }
}

async function ensureSessionsTableCompatibility(connection: mysql.PoolConnection) {
  await ensureColumnExists(connection, 'sessions', 'title', 'title VARCHAR(200) NULL');
  await ensureColumnExists(
    connection,
    'sessions',
    'status',
    "status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active'"
  );
  await ensureColumnExists(connection, 'sessions', 'last_message_at', 'last_message_at TIMESTAMP NULL');
  await ensureColumnExists(connection, 'sessions', 'last_reasoner_run_at', 'last_reasoner_run_at TIMESTAMP NULL');
  await ensureColumnExists(
    connection,
    'sessions',
    'message_count_since_reasoner',
    'message_count_since_reasoner INT NOT NULL DEFAULT 0'
  );
  await ensureColumnExists(connection, 'sessions', 'profile_version', 'profile_version INT NOT NULL DEFAULT 0');
  await ensureColumnExists(
    connection,
    'sessions',
    'is_minor_flagged',
    'is_minor_flagged BOOLEAN NOT NULL DEFAULT FALSE'
  );
  await ensureColumnExists(
    connection,
    'sessions',
    'privacy_cleared_at',
    'privacy_cleared_at TIMESTAMP NULL'
  );

  await connection.query(`UPDATE sessions SET status = 'active' WHERE status IS NULL OR status = ''`);
}

async function ensureColumnExists(
  connection: mysql.PoolConnection,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  if (rows.length === 0) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}
