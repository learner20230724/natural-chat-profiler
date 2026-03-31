import mysql from 'mysql2/promise';
import { config } from '../../config';

export type DatabasePool = mysql.Pool;
export type DatabaseConnection = mysql.PoolConnection;
export type DatabaseExecutor = DatabasePool | DatabaseConnection;

export function createMySqlPool() {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

export async function verifyDatabaseConnection(pool: DatabasePool) {
  const connection = await pool.getConnection();
  connection.release();
}
