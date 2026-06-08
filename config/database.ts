// config/database.ts
import pg, { type Pool, type QueryResult } from 'pg';
const { Pool, types } = pg;

const config = await import('./index.ts');
const cfg = config.default;

// Configure pg to parse BIGINT (OID 20, e.g. COUNT()) as integer
types.setTypeParser(20, (val: string) => parseInt(val, 10));

const pool = new Pool({
  ...cfg.database,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 0, // disable idle timeout — let PostgreSQL manage it
  max: 10,               // lower max to avoid connection-limit issues
  allowExitOnIdle: true,
  keepAlive: true,
  keepAliveInitialDelayMillis: 30000,
});

pool.on('error', (err: Error) => {
  console.error('[pg:pool] 空闲客户端错误:', err.message);
  // pg will remove the bad client automatically
});

// Set session timezone and timeouts on connect
pool.on('connect', async (client: pg.PoolClient) => {
  const offset = cfg.timezoneOffset;
  const absOffset = Math.abs(offset);

  try {
    if (offset === 8) {
      await client.query("SET TIME ZONE 'Asia/Shanghai'");
    } else {
      const pgSign = offset >= 0 ? '-' : '+';
      await client.query(`SET TIME ZONE 'Etc/GMT${pgSign}${absOffset}'`);
    }
  } catch (err) {
    console.warn('设置时区失败 (非关键):', (err as Error).message);
  }

  try {
    await client.query("SET statement_timeout = '30s'");
  } catch (err) {
    console.warn('设置 statement_timeout 失败:', (err as Error).message);
  }

  try {
    await client.query("SET idle_in_transaction_session_timeout = '60s'");
  } catch (err) {
    console.warn('设置 idle_in_transaction_session_timeout 失败:', (err as Error).message);
  }
});

// SQL placeholder: ? → $1, $2, …
function transformSql(sql: string): string {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

export interface DbRow {
  [column: string]: unknown;
}

export interface DbRunResult {
  lastID: number | null;
  changes: number;
}

const db = {
  /**
   * Fetch the first matching row.
   */
  async get<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const transformedSql = transformSql(sql);
    const res = await pool.query(transformedSql, params);
    return res.rows[0] as T | undefined;
  },

  /**
   * Execute a write query. Returns {lastID, changes}.
   */
  async run(sql: string, params: unknown[] = []): Promise<DbRunResult> {
    const transformedSql = transformSql(sql);
    const res = await pool.query(transformedSql, params);
    return {
      lastID: res.rows?.[0]?.id ?? null,
      changes: res.rowCount ?? 0
    };
  },

  /**
   * Fetch all matching rows.
   */
  async all<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const transformedSql = transformSql(sql);
    const res = await pool.query(transformedSql, params);
    return res.rows as T[];
  },

  /**
   * Execute a raw query with full result.
   */
  async query<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return pool.query<T>(sql, params);
  },

  close(): Promise<void> {
    return pool.end();
  },

  // Expose pool for direct PG access
  pool
};

console.log('PostgreSQL connection pool initialized');

export default db;
