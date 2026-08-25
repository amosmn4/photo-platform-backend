import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Idle client errors (dropped connections etc.) must not crash the
  // process — log and let the pool recycle the connection.
  logger.error({ err }, 'Unexpected error on idle Postgres client');
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const durationMs = Date.now() - start;
  if (durationMs > 200) {
    logger.warn({ durationMs, text }, 'Slow query');
  }
  return result;
}

/**
 * Runs `fn` inside a single transaction. Rolls back on any thrown error.
 * Use for anything that touches more than one table where partial writes
 * would leave the system inconsistent (e.g. creating an event + its default
 * access token).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
